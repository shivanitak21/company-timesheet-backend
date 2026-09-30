import { Schema, model, type Types } from 'mongoose';
import { PROJECT_STATUSES, type ProjectStatus } from '../types/enums';

export interface IProject {
  name: string;
  code: string;
  description: string;
  manager: Types.ObjectId;
  status: ProjectStatus;
  members: Types.ObjectId[];
  startDate?: string;
  endDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '', trim: true },
    manager: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: PROJECT_STATUSES, required: true, default: 'active' },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    startDate: { type: String },
    endDate: { type: String },
  },
  { timestamps: true, collection: 'projects', versionKey: false },
);

export const Project = model<IProject>('Project', projectSchema);
