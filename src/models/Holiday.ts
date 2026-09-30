import { Schema, model, type Types } from 'mongoose';

export interface IHoliday {
  name: string;
  date: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const holidaySchema = new Schema<IHoliday>(
  {
    name: { type: String, required: true, trim: true },
    date: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'holidays', versionKey: false },
);

export const Holiday = model<IHoliday>('Holiday', holidaySchema);
