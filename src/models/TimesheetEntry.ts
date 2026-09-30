import { Schema, model, type Types } from 'mongoose';
import { WORK_TYPES, type WorkType } from '../types/enums';

export interface ITimesheetEntry {
  timesheet: Types.ObjectId;
  user: Types.ObjectId;
  date: string;
  project?: Types.ObjectId;
  task?: Types.ObjectId;
  workType: WorkType;
  description: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const timesheetEntrySchema = new Schema<ITimesheetEntry>(
  {
    timesheet: { type: Schema.Types.ObjectId, ref: 'Timesheet', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project' },
    task: { type: Schema.Types.ObjectId, ref: 'Task' },
    workType: { type: String, enum: WORK_TYPES, required: true },
    description: { type: String, required: true, trim: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    startMinutes: { type: Number, required: true, min: 0, max: 1440 },
    endMinutes: { type: Number, required: true, min: 0, max: 1440 },
    durationMinutes: { type: Number, required: true, min: 1 },
  },
  { timestamps: true, collection: 'timesheet_entries', versionKey: false },
);

timesheetEntrySchema.index({ user: 1, date: 1 });
timesheetEntrySchema.index({ timesheet: 1, date: 1 });

export const TimesheetEntry = model<ITimesheetEntry>('TimesheetEntry', timesheetEntrySchema);
