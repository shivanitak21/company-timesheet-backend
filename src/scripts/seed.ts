import { connectDb, disconnectDb } from '../config/db';
import { EmployeeProfile } from '../models/EmployeeProfile';
import { Project } from '../models/Project';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { hashPassword } from '../utils/password';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Set it in .env before running npm run seed.`);
  return value;
}

async function upsertUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'employee';
}) {
  const existing = await User.findOne({ email: input.email });
  if (existing) return existing;
  return User.create({
    email: input.email,
    passwordHash: await hashPassword(input.password),
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    isActive: true,
  });
}

async function main() {
  await connectDb();
  const admin = await upsertUser({
    email: (process.env.SEED_ADMIN_EMAIL ?? 'admin@company.com').toLowerCase(),
    password: required('SEED_ADMIN_PASSWORD'),
    firstName: process.env.SEED_ADMIN_FIRST_NAME ?? 'System',
    lastName: process.env.SEED_ADMIN_LAST_NAME ?? 'Admin',
    role: 'admin',
  });
  console.log(`Admin ready: ${admin.email}`);

  if (process.env.SEED_DEMO === 'true') {
    const demoPassword = required('SEED_DEMO_PASSWORD');
    const manager = await upsertUser({
      email: 'manager@company.com',
      password: demoPassword,
      firstName: 'Maya',
      lastName: 'Manager',
      role: 'manager',
    });
    const employee = await upsertUser({
      email: 'employee@company.com',
      password: demoPassword,
      firstName: 'Evan',
      lastName: 'Employee',
      role: 'employee',
    });

    await EmployeeProfile.updateOne(
      { user: manager._id },
      {
        user: manager._id,
        employeeCode: 'MGR001',
        department: 'Engineering',
        designation: 'Engineering Manager',
        joiningDate: '2024-01-01',
        employmentType: 'full_time',
        weeklyHours: 40,
      },
      { upsert: true },
    );
    await EmployeeProfile.updateOne(
      { user: employee._id },
      {
        user: employee._id,
        employeeCode: 'EMP001',
        department: 'Engineering',
        designation: 'Software Engineer',
        joiningDate: '2024-06-01',
        employmentType: 'full_time',
        weeklyHours: 40,
        manager: manager._id,
      },
      { upsert: true },
    );

    const project = await Project.findOneAndUpdate(
      { code: 'PRJ-INT' },
      {
        name: 'Internal',
        code: 'PRJ-INT',
        description: 'Company internal work',
        manager: manager._id,
        status: 'active',
        members: [],
      },
      { upsert: true, new: true },
    );
    if (project) {
      const existingTask = await Task.findOne({ title: 'Timesheet onboarding', assignedTo: employee._id });
      if (!existingTask) {
        await Task.create({
          project: project._id,
          title: 'Timesheet onboarding',
          description: 'Log time against this assigned task.',
          assignedTo: employee._id,
          assignedBy: manager._id,
          status: 'todo',
          priority: 'medium',
        });
      }
    }
    console.log('Demo manager, employee, project, and task ready.');
  }

  await disconnectDb();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
