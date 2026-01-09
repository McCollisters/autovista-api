import mongoose, { Document, Types } from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import {
  createSchema,
  createReferenceField,
  createStatusField,
} from "../_global/schemas/factory";
import { Status } from "../_global/enums";

export enum Role {
  PlatformAdmin = "platform_admin",
  PlatformUser = "platform_user",
  PortalAdmin = "portal_admin",
  PortalUser = "portal_user",
  PublicUser = "public_user",
}

export interface IUser extends Document {
  portalId: Types.ObjectId;
  email: string;
  password: string;
  role: Role;
  status: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  mobilePhone?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  verificationCode?: string;
  verificationCodeSent?: Date;
  verificationCodeExpires?: Date;
  comparePassword(plaintext: string): Promise<boolean>;
  generatePasswordReset(): void;
}

const userSchema = createSchema<IUser>({
  portalId: createReferenceField("Portal", true),
  email: { type: String, trim: true, required: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  status: createStatusField(Status, true),
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  phone: String,
  mobilePhone: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  verificationCode: String,
  verificationCodeSent: Date,
  verificationCodeExpires: Date,
});

userSchema.virtual("fullName").get(function (this: any) {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.set("toJSON", {
  virtuals: true,
});

// Normalize status field to lowercase enum values
userSchema.pre("save", function (this: IUser, next: (error?: any) => void) {
  if (this.isModified("status") && this.status) {
    // Normalize status to lowercase to match enum values
    const normalizedStatus = this.status.toLowerCase();
    // Only update if it's a valid enum value
    if (Object.values(Status).includes(normalizedStatus as Status)) {
      this.status = normalizedStatus;
    }
  }
  next();
});

userSchema.pre(
  "save",
  async function (this: IUser, next: (error?: any) => void) {
    if (!this.isModified("password")) return next();
    try {
      this.password = await bcrypt.hash(this.password, 10);
      next();
    } catch (error) {
      next(error as any);
    }
  },
);

userSchema.methods.comparePassword = function (
  plaintext: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, this.password);
};

userSchema.methods.generatePasswordReset = function () {
  this.resetPasswordToken = crypto.randomBytes(20).toString("hex");
  this.resetPasswordExpires = new Date(Date.now() + 3600000); // Expires in 1 hour
};

// Model is exported from model.ts file
export { userSchema };
