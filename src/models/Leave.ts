import { Schema, model, type Types } from 'mongoose';
import { LEAVE_STATUSES, LEAVE_TYPES, type LeaveStatus, type LeaveType } from '../types/enums';

export interface ILeave {
  user: Types.ObjectId;
  type: LeaveType;
  startDate: string;
  endDate: string;
  dayCount: number;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leaveSchema = new Schema<ILeave>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: LEAVE_TYPES, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    dayCount: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: LEAVE_STATUSES, required: true, default: 'pending' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true, collection: 'leaves', versionKey: false },
);

leaveSchema.index({ user: 1, status: 1, startDate: 1, endDate: 1 });

export const Leave = model<ILeave>('Leave', leaveSchema);
