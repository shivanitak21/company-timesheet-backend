import { Schema, model, type Types } from 'mongoose';

export interface IRefreshToken {
  user: Types.ObjectId;
  jti: string;
  family: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByJti?: string;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jti: { type: String, required: true, unique: true },
    family: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedByJti: { type: String },
    userAgent: { type: String },
    ip: { type: String },
  },
  { timestamps: true, collection: 'refresh_tokens', versionKey: false },
);

refreshTokenSchema.index({ user: 1 });
refreshTokenSchema.index({ family: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema);
