/**
 * Quote-specific interfaces
 */

import { Document, Types } from "mongoose";
import {
  Status,
  USState,
  TransportType,
  ServiceLevelOption,
  VehicleClass,
} from "../_global/enums";
import {
  IPricingQuote,
  IVehicle,
  IHistoryItem,
  ICustomer,
  IContact,
  IAddress,
} from "../_global/schemas/types";

export interface IQuoteCustomer extends ICustomer {
  name?: string;
  email?: string;
  phone?: string;
  trackingCode?: string;
  quoteConfirmationCode?: string;
}

export interface IQuoteLocation {
  userInput: string;
  validated: string;
  state?: USState;
  coordinates?: {
    long: string;
    lat: string;
  };
}

export interface IQuote extends Document {
  refId?: number;
  isDirect: boolean;
  status: Status;
  portal: Types.ObjectId;
  user?: Types.ObjectId;
  origin: IQuoteLocation;
  destination: IQuoteLocation;
  miles?: number;
  transportType?: TransportType;
  transitTime?: [number, number];
  vehicles: Array<IVehicle>;
  totalPricing: IPricingQuote;
  archivedAt?: Date;
  customer?: IQuoteCustomer;
  history: Array<IHistoryItem>;
}
