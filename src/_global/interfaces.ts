import { Types } from 'mongoose';
import { USState, ServiceLevelOption } from "./enums";

export interface IServiceLevelMarkup {
    serviceLevelOption: ServiceLevelOption;
    value: number; 
}

export interface IGlobalMarkups {
    total: number;
    inoperable: number;
    oversize: number;
    serviceLevels: Array<IServiceLevelMarkup>;
}

export interface IPortalMarkups {
    total: number;
    commission: number;
    companyTariff: number;
}0

export interface ITotalByServiceLevel {
    serviceLevelOption: ServiceLevelOption;
    total: number;
}

export interface IPricing {
    base: number;
    globalMarkups: IGlobalMarkups;
    portalMarkups: IPortalMarkups;
    total: number;
    totalsByServiceLevel: Array<ITotalByServiceLevel>;
}

export interface IVehicle {
    make: string;
    model: string;
    isOperable: boolean;  
    pricing?: IPricing; 
    vin?: string;
    year?: string;
}

export interface IContact {
    name?: string;
    email?: string; 
    phone?: string;
    phoneMobile?: string;
    notes?: string;
}

export interface IAddress {
    address?: string;
    addressLine2?: string;
    city?: string; 
    state?: USState;
    zip?: string;
    notes?: string;
    longitude?: string;
    latittude?: string;
}

export interface ISchedule {
    serviceLevel: ServiceLevelOption;
    pickupSelected: Date; 
    deliveryEstimated: Date;
    pickupCompleted: Date;
    deliveryCompleted: Date; 
    notes: string;
}

export interface IHistoryItem {
    modifiedAt: Date;
    modifiedBy?: Types.ObjectId; 
    changes: {
        field: string;
        oldValue: any;
        newValue: any;
    }[];
}