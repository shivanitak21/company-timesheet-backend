import { Schema, model, type Types } from 'mongoose';
import { ROLES, type Role } from '../types/enums';

export interface IUser {
  email: string;
  passwordHash: string;
  role: Role;
  firstName: string;
  lastName: string;
  isActive: boolean;
  passwordChangedAt?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, collection: 'users', versionKey: false },
);

export type UserDocument = IUser & { _id: Types.ObjectId };
export const User = model<IUser>('User', userSchema);
