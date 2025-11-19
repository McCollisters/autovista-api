import mongoose, { Document } from "mongoose";
import { createSchema } from "../_global/schemas/factory";

export interface IEmailTemplate extends Document {
  templateName: string;
  lastUpdated?: Date;
  subject?: string;
  senderEmail: string;
  senderName: string;
  emailHeader?: string;
  emailIntro?: string;
  emailBody?: string;
  emailFooter?: string;
  showInPortal?: boolean;
  mcOnly?: boolean;
}

const emailTemplateSchema = createSchema<IEmailTemplate>(
  {
    templateName: { type: String, required: true, unique: true },
    lastUpdated: { type: Date, default: Date.now },
    subject: { type: String },
    senderEmail: { type: String, required: true },
    senderName: { type: String, required: true },
    emailHeader: { type: String },
    emailIntro: { type: String },
    emailBody: { type: String },
    emailFooter: { type: String },
    showInPortal: { type: Boolean, default: false },
    mcOnly: { type: Boolean, default: false },
  },
  {
    timestamps: false, // We're managing lastUpdated manually
  },
);

// Update lastUpdated on save
emailTemplateSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.lastUpdated = new Date();
  }
  next();
});

// Model is exported from model.ts file
export { emailTemplateSchema };

