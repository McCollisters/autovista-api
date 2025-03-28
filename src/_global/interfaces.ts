import { USState, ServiceLevelOption } from "./enums";

export interface ServiceLevelMarkups {
    serviceLevelOption: ServiceLevelOption;
    value: number; 
}

export interface GlobalMarkups {
    total: number;
    inoperable: number;
    oversize: number;
    serviceLevels: ServiceLevelMarkups;
}

export interface PortalMarkups {
    total: number;
    commission: number;
    companyTariff: number;
}0

export interface TotalByServiceLevel {
    serviceLevelOption: ServiceLevelOption;
    total: number;
}

export interface Pricing {
    base: number;
    globalMarkups: GlobalMarkups;
    portalMarkups: PortalMarkups;
    total: number;
    totalsByServiceLevel: Array<TotalByServiceLevel>;
}

export interface Vehicle {
    make: string;
    model: string;
    isOperable: boolean;  
    pricing?: Pricing; 
    vin?: string;
    year?: string;
}

export interface Contact {
    name?: string;
    email?: string; 
    phone?: string;
    phoneMobile?: string;
    notes?: string;
}

export interface Address {
    address?: string;
    addressLine2?: string;
    city?: string; 
    state?: USState;
    zip?: string;
    notes?: string;
    longitude?: string;
    latittude?: string;
}

export interface Schedule {
    serviceLevel: ServiceLevelOption;
    pickupSelected: Date; 
    deliveryEstimated: Date;
    pickupCompleted: Date;
    deliveryCompleted: Date; 
    notes: string;
}