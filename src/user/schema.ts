import mongoose, { Schema, Document, Model, Types } from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";

export interface IUser extends Document {
  portalId: Types.ObjectId;
  email: string;
  password: string;
  role: string;
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

const userSchemaFields: Record<keyof Omit<IUser, keyof Document | "comparePassword" | "generatePasswordReset">, any> = {
    portalId: { type: Schema.Types.ObjectId, ref: "Portal", required: true },
    email: { type: String, trim: true, required: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    status: { type: String, required: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    phone: String,
    mobilePhone: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    verificationCode: String,
    verificationCodeSent: Date,
    verificationCodeExpires: Date,
};

const userSchema = new Schema<IUser>(userSchemaFields, { timestamps: true });

// Hash password before saving user
userSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error as any);
  }
});

userSchema.methods.comparePassword = function (plaintext: string): Promise<boolean> {
  return bcrypt.compare(plaintext, this.password);
};

userSchema.methods.generatePasswordReset = function () {
  this.resetPasswordToken = crypto.randomBytes(20).toString("hex");
  this.resetPasswordExpires = new Date(Date.now() + 3600000); // Expires in 1 hour
};

const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
export { User };
