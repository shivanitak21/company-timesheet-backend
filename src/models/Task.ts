import { Schema, model, type Types } from 'mongoose';
import { PRIORITIES, TASK_STATUSES, type Priority, type TaskStatus } from '../types/enums';

export interface ITask {
  project: Types.ObjectId;
  title: string;
  description: string;
  assignedTo: Types.ObjectId;
  assignedBy: Types.ObjectId;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  estimatedMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: TASK_STATUSES, required: true, default: 'todo' },
    priority: { type: String, enum: PRIORITIES, required: true, default: 'medium' },
    dueDate: { type: String },
    estimatedMinutes: { type: Number, min: 1 },
  },
  { timestamps: true, collection: 'tasks', versionKey: false },
);

taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ project: 1 });

export const Task = model<ITask>('Task', taskSchema);
