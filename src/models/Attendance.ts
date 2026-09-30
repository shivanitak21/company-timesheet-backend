import { Schema, model, type Types } from 'mongoose';
import { ATTENDANCE_STATUSES, PLATFORMS, type AttendanceStatus, type Platform } from '../types/enums';

export interface IAttendance {
  user: Types.ObjectId;
  date: string;
  checkInAt: Date;
  checkOutAt?: Date;
  status: AttendanceStatus;
  workMinutes?: number;
  notes?: string;
  platform: Platform;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    checkInAt: { type: Date, required: true },
    checkOutAt: { type: Date },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    workMinutes: { type: Number, min: 0 },
    notes: { type: String, trim: true },
    platform: { type: String, enum: PLATFORMS, default: 'unknown' },
  },
  { timestamps: true, collection: 'attendances', versionKey: false },
);

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

export const Attendance = model<IAttendance>('Attendance', attendanceSchema);
