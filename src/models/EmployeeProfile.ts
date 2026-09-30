import { Schema, model, type Types } from 'mongoose';
import { EMPLOYMENT_TYPES, type EmploymentType } from '../types/enums';

export interface IEmployeeProfile {
  user: Types.ObjectId;
  employeeCode: string;
  department: string;
  designation: string;
  joiningDate: string;
  employmentType: EmploymentType;
  weeklyHours: number;
  phone?: string;
  manager?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const employeeProfileSchema = new Schema<IEmployeeProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    department: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    joiningDate: { type: String, required: true },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, required: true },
    weeklyHours: { type: Number, required: true, default: 40, min: 1, max: 80 },
    phone: { type: String, trim: true },
    manager: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'employee_profiles', versionKey: false },
);

employeeProfileSchema.index({ manager: 1 });

export const EmployeeProfile = model<IEmployeeProfile>('EmployeeProfile', employeeProfileSchema);
