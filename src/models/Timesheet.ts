import { Schema, model, type Types } from 'mongoose';
import { TIMESHEET_STATUSES, type TimesheetStatus } from '../types/enums';

export interface ITimesheet {
  user: Types.ObjectId;
  year: number;
  month: number;
  status: TimesheetStatus;
  totalMinutes: number;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const timesheetSchema = new Schema<ITimesheet>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    status: { type: String, enum: TIMESHEET_STATUSES, required: true, default: 'draft' },
    totalMinutes: { type: Number, required: true, default: 0, min: 0 },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true, collection: 'timesheets', versionKey: false },
);

timesheetSchema.index({ user: 1, year: 1, month: 1 }, { unique: true });
timesheetSchema.index({ status: 1, submittedAt: -1 });

export const Timesheet = model<ITimesheet>('Timesheet', timesheetSchema);
