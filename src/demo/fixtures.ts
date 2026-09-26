import { Role } from "@/user/schema";

/**
 * Stable demo fixture IDs (valid 24-char hex ObjectId shape).
 * Shared contract with the portal when Demo Mode is on.
 */
export const DEMO_PORTAL_ID = "64aaaaaaaaaaaaaaaaaaaa01";
export const DEMO_PORTAL_B_ID = "64aaaaaaaaaaaaaaaaaaaa02";
export const DEMO_USER_ADMIN_ID = "64bbbbbbbbbbbbbbbbbbbb01";
export const DEMO_USER_AGENT_ID = "64bbbbbbbbbbbbbbbbbbbb02";
export const DEMO_USER_AGENT_B_ID = "64bbbbbbbbbbbbbbbbbbbb03";
export const DEMO_ORDER_IDS = [
  "64cccccccccccccccccccc01",
  "64cccccccccccccccccccc02",
  "64cccccccccccccccccccc03",
  "64cccccccccccccccccccc04",
  "64cccccccccccccccccccc05",
  "64cccccccccccccccccccc06",
  "64cccccccccccccccccccc07",
  "64cccccccccccccccccccc08",
  "64cccccccccccccccccccc09",
  "64cccccccccccccccccccc0a",
] as const;
export const DEMO_QUOTE_IDS = [
  "64dddddddddddddddddddd01",
  "64dddddddddddddddddddd02",
  "64dddddddddddddddddddd03",
  "64dddddddddddddddddddd04",
  "64dddddddddddddddddddd05",
  "64dddddddddddddddddddd06",
  "64dddddddddddddddddddd07",
  "64dddddddddddddddddddd08",
  "64dddddddddddddddddddd09",
  "64dddddddddddddddddddd0a",
] as const;

const now = new Date("2026-03-15T15:00:00.000Z");
const daysAgo = (n: number) =>
  new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const demoPortal = {
  _id: DEMO_PORTAL_ID,
  companyName: "Horizon Auto Logistics",
  logo: null,
  displayMCLogo: true,
  status: "active",
  options: {},
  allowsCustomerTracking: true,
  modifierSet: {
    portal: DEMO_PORTAL_ID,
    companyTariff: 50,
    companyTariffEnclosedFee: 75,
    companyTariffDiscount: 0,
    discount: 0,
    whiteGlove: 0,
    fuel: 0,
    irr: 0,
    oversize: 0,
    enclosed: 0,
    portalWideCommission: 25,
  },
};

/** Secondary portal only used if platform list is ever requested; demo POV uses primary. */
const demoPortalB = {
  _id: DEMO_PORTAL_B_ID,
  companyName: "Summit Relocation Partners",
  logo: null,
  displayMCLogo: true,
  status: "active",
  options: {},
  allowsCustomerTracking: true,
  modifierSet: {
    portal: DEMO_PORTAL_B_ID,
    companyTariff: 40,
    companyTariffEnclosedFee: 60,
    companyTariffDiscount: 0,
    discount: 0,
    whiteGlove: 0,
    fuel: 0,
    irr: 0,
    oversize: 0,
    enclosed: 0,
    portalWideCommission: 20,
  },
};

const demoUserAdmin = {
  _id: DEMO_USER_ADMIN_ID,
  email: "admin@horizon-auto.example.com",
  firstName: "Alex",
  lastName: "Rivera",
  role: Role.PortalAdmin,
  status: "active",
  phone: "(555) 201-1000",
  mobilePhone: "(555) 201-1001",
  portalId: {
    _id: DEMO_PORTAL_ID,
    companyName: demoPortal.companyName,
    logo: null,
  },
  portalRoles: [
    {
      portalId: {
        _id: DEMO_PORTAL_ID,
        companyName: demoPortal.companyName,
        logo: null,
      },
      role: Role.PortalAdmin,
    },
  ],
  portal: {
    _id: DEMO_PORTAL_ID,
    companyName: demoPortal.companyName,
    logo: null,
  },
};

const demoUserAgent = {
  _id: DEMO_USER_AGENT_ID,
  email: "jordan.lee@horizon-auto.example.com",
  firstName: "Jordan",
  lastName: "Lee",
  role: Role.PortalUser,
  status: "active",
  phone: "(555) 201-2000",
  portalId: {
    _id: DEMO_PORTAL_ID,
    companyName: demoPortal.companyName,
  },
  portalRoles: [
    {
      portalId: {
        _id: DEMO_PORTAL_ID,
        companyName: demoPortal.companyName,
      },
      role: Role.PortalUser,
    },
  ],
};

const demoUserAgentB = {
  _id: DEMO_USER_AGENT_B_ID,
  email: "sam.patel@horizon-auto.example.com",
  firstName: "Sam",
  lastName: "Patel",
  role: Role.PortalUser,
  status: "active",
  phone: "(555) 201-3000",
  portalId: {
    _id: DEMO_PORTAL_ID,
    companyName: demoPortal.companyName,
  },
  portalRoles: [
    {
      portalId: {
        _id: DEMO_PORTAL_ID,
        companyName: demoPortal.companyName,
      },
      role: Role.PortalUser,
    },
  ],
};

function vehicle(
  year: number,
  make: string,
  model: string,
  total: number,
  opts?: {
    commission?: number;
    companyTariff?: number;
    operable?: boolean;
    pricingClass?: string;
    vin?: string;
  },
) {
  const commission = opts?.commission ?? 25;
  const companyTariff = opts?.companyTariff ?? 50;
  const operable = opts?.operable ?? true;
  const base = Math.max(total - commission - companyTariff, 0);
  return {
    year,
    make,
    model,
    vin: opts?.vin ?? `1DEMO${String(year).slice(-2)}${make.slice(0, 3).toUpperCase()}00${String(total).padStart(6, "0")}`.slice(0, 17),
    pricingClass: opts?.pricingClass ?? "sedan",
    operable,
    isInoperable: !operable,
    pricing: {
      base,
      total: base,
      totalWithCompanyTariffAndCommission: total,
      modifiers: { commission, companyTariff },
    },
  };
}

type DemoOrderStop = {
  city: string;
  state: string;
  zip: string;
  street: string;
  locationType?: string;
  companyName?: string;
};

function location(
  stop: DemoOrderStop,
  contactName: string,
  phone: string,
) {
  const { city, state, zip, street } = stop;
  return {
    notes: "",
    locationType: stop.locationType || "residence",
    contact: {
      name: contactName,
      companyName: stop.companyName || "",
      email: `${contactName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      phone,
      phoneMobile: phone,
      phoneAlt: "",
    },
    address: {
      address: street,
      addressLine2: "",
      city,
      state,
      zip,
    },
    validated: `${street}, ${city}, ${state} ${zip}`,
    userInput: `${city}, ${state}`,
    longitude: "0",
    latitude: "0",
  };
}

function buildOrderSchedule(opts: {
  daysAgoCreated: number;
  pickupCompleted?: boolean;
  deliveryCompleted?: boolean;
}) {
  const created = opts.daysAgoCreated;
  if (opts.deliveryCompleted) {
    return {
      pickupSelected: daysAgo(Math.max(created - 3, 1)),
      pickupCompleted: daysAgo(Math.max(created - 5, 1)),
      deliveryEstimated: [daysAgo(Math.max(created - 8, 1))],
      deliveryCompleted: daysAgo(Math.max(created - 10, 1)),
    };
  }
  if (opts.pickupCompleted) {
    return {
      pickupSelected: daysAgo(Math.max(created - 2, 1)),
      pickupCompleted: daysAgo(Math.max(created - 4, 1)),
      deliveryEstimated: [daysAgo(-3)],
      deliveryCompleted: null,
    };
  }
  return {
    pickupSelected: daysAgo(-4),
    pickupCompleted: null,
    deliveryEstimated: [daysAgo(-9)],
    deliveryCompleted: null,
  };
}

function buildOrder(
  id: string,
  refId: number,
  opts: {
    customerName: string;
    email: string;
    phone: string;
    status: string;
    paymentType?: string;
    daysAgoCreated: number;
    pickupCompleted?: boolean;
    deliveryCompleted?: boolean;
    reg: string;
    origin: DemoOrderStop;
    destination: DemoOrderStop;
    vehicles: ReturnType<typeof vehicle>[];
    transportType?: "OPEN" | "ENCLOSED" | "WHITEGLOVE";
    serviceLevel?: number;
    miles: number;
    agent?: typeof demoUserAgent;
  },
) {
  const agent = opts.agent || demoUserAgent;
  const vehicles = opts.vehicles;
  const commission = vehicles.reduce(
    (sum, v) => sum + (v.pricing?.modifiers?.commission || 0),
    0,
  );
  const companyTariff = vehicles.reduce(
    (sum, v) => sum + (v.pricing?.modifiers?.companyTariff || 0),
    0,
  );
  const total = vehicles.reduce(
    (sum, v) => sum + (v.pricing?.totalWithCompanyTariffAndCommission || 0),
    0,
  );
  const transportType = opts.transportType || "OPEN";

  return {
    _id: id,
    refId,
    reg: opts.reg,
    status: opts.status,
    orderTableStatus: opts.deliveryCompleted
      ? "Delivered"
      : opts.pickupCompleted
        ? "Picked Up"
        : "New",
    paymentType: opts.paymentType || "BILLING",
    portalId: {
      _id: DEMO_PORTAL_ID,
      companyName: demoPortal.companyName,
      logo: null,
      options: {},
      displayMCLogo: true,
    },
    userId: {
      _id: agent._id,
      firstName: agent.firstName,
      lastName: agent.lastName,
    },
    customer: {
      name: opts.customerName,
      firstName: opts.customerName.split(" ")[0],
      lastName: opts.customerName.split(" ").slice(1).join(" ") || "Customer",
      email: opts.email,
      phone: opts.phone,
    },
    origin: location(opts.origin, opts.customerName, opts.phone),
    destination: location(opts.destination, opts.customerName, opts.phone),
    vehicles,
    miles: opts.miles,
    transportType,
    serviceLevel: opts.serviceLevel ?? 3,
    schedule: buildOrderSchedule(opts),
    totalPricing: {
      total: total - commission - companyTariff,
      totalWithCompanyTariffAndCommission: total,
      modifiers: { commission, companyTariff },
    },
    createdAt: daysAgo(opts.daysAgoCreated),
    bookedAt: daysAgo(opts.daysAgoCreated),
    tms: {
      status: opts.deliveryCompleted
        ? "delivered"
        : opts.pickupCompleted
          ? "picked_up"
          : "new",
      // Order Detail maps tms.createdAt → "Booked On"
      createdAt: daysAgo(opts.daysAgoCreated),
      updatedAt: daysAgo(
        opts.deliveryCompleted
          ? Math.max(opts.daysAgoCreated - 10, 0)
          : opts.pickupCompleted
            ? Math.max(opts.daysAgoCreated - 4, 0)
            : opts.daysAgoCreated,
      ),
    },
  };
}

type DemoRoute = {
  origin: { city: string; state: string };
  destination: { city: string; state: string };
  miles: number;
  transitTime: [number, number];
};

function quoteLocation(city: string, state: string) {
  const label = `${city}, ${state}`;
  return {
    userInput: label,
    validated: label,
    city,
    state,
  };
}

function pricingLane(
  mccTotal: number,
  commission: number,
  companyTariff: number,
) {
  if (mccTotal <= 0) {
    return {
      total: 0,
      companyTariff: 0,
      commission: 0,
      totalWithCompanyTariffAndCommission: 0,
    };
  }
  return {
    total: mccTotal,
    companyTariff,
    commission,
    totalWithCompanyTariffAndCommission:
      mccTotal + companyTariff + commission,
  };
}

function buildQuote(
  id: string,
  refId: number,
  opts: {
    customerName: string;
    email: string;
    phone: string;
    status: string;
    daysAgoCreated: number;
    route: DemoRoute;
    vehicles: ReturnType<typeof vehicle>[];
    transportType?: "OPEN" | "ENCLOSED" | "WHITEGLOVE";
    agent?: typeof demoUserAgent;
  },
) {
  const agent = opts.agent || demoUserAgent;
  const { origin, destination, miles, transitTime } = opts.route;
  const transportType = opts.transportType || "OPEN";
  const isWhiteGlove = transportType === "WHITEGLOVE";
  const isEnclosed = transportType === "ENCLOSED";
  const vehicleCount = opts.vehicles.length || 1;
  const commissionPerVehicle = 25;
  const tariffPerVehicle = isEnclosed ? 75 : 50;
  const commission = commissionPerVehicle * vehicleCount;
  const companyTariff = tariffPerVehicle * vehicleCount;
  const total = opts.vehicles.reduce(
    (sum, v) => sum + (v.pricing?.totalWithCompanyTariffAndCommission || 0),
    0,
  );

  // Selected transport customer total → McCollister's base for the ladder.
  const selectedMcc = Math.max(total - commission - companyTariff, 0);
  // Always fill open + enclosed ladders so Quote Detail rate rows are complete.
  const openThree = isEnclosed || isWhiteGlove
    ? Math.round(selectedMcc * 0.85)
    : selectedMcc;
  const enclosedThree = isEnclosed
    ? selectedMcc
    : Math.round(selectedMcc * 1.2);
  const whiteGloveTotal = isWhiteGlove
    ? total
    : Math.round(selectedMcc * 1.55 + commission);

  const openEnclosedTotals = {
    one: {
      open: pricingLane(
        Math.round(openThree * 1.12),
        commission,
        companyTariff,
      ),
      enclosed: pricingLane(
        Math.round(enclosedThree * 1.1),
        commission,
        isEnclosed ? companyTariff : Math.round(companyTariff * 1.2),
      ),
    },
    three: {
      open: pricingLane(openThree, commission, companyTariff),
      enclosed: pricingLane(
        enclosedThree,
        commission,
        isEnclosed ? companyTariff : Math.round(companyTariff * 1.2),
      ),
    },
    five: {
      open: pricingLane(
        Math.round(openThree * 0.94),
        commission,
        companyTariff,
      ),
      enclosed: pricingLane(
        Math.round(enclosedThree * 0.95),
        commission,
        isEnclosed ? companyTariff : Math.round(companyTariff * 1.2),
      ),
    },
    seven: {
      open: pricingLane(
        Math.round(openThree * 0.88),
        commission,
        companyTariff,
      ),
      enclosed: pricingLane(
        Math.round(enclosedThree * 0.9),
        commission,
        isEnclosed ? companyTariff : Math.round(companyTariff * 1.2),
      ),
    },
  };

  // Mirror quote-level totals onto each vehicle so PricingDetail aggregations work.
  const vehicles = opts.vehicles.map((v) => {
    const share =
      total > 0
        ? (v.pricing?.totalWithCompanyTariffAndCommission || 0) / total
        : 1 / vehicleCount;
    const vCommission = v.pricing?.modifiers?.commission ?? commissionPerVehicle;
    const vTariff = v.pricing?.modifiers?.companyTariff ?? tariffPerVehicle;
    const scaleLane = (lane: ReturnType<typeof pricingLane>) =>
      pricingLane(
        Math.round(lane.total * share),
        vCommission,
        Math.round(lane.companyTariff * share) || vTariff,
      );

    return {
      ...v,
      pricing: {
        ...v.pricing,
        totals: {
          one: {
            open: scaleLane(openEnclosedTotals.one.open),
            enclosed: scaleLane(openEnclosedTotals.one.enclosed),
          },
          three: {
            open: scaleLane(openEnclosedTotals.three.open),
            enclosed: scaleLane(openEnclosedTotals.three.enclosed),
          },
          five: {
            open: scaleLane(openEnclosedTotals.five.open),
            enclosed: scaleLane(openEnclosedTotals.five.enclosed),
          },
          seven: {
            open: scaleLane(openEnclosedTotals.seven.open),
            enclosed: scaleLane(openEnclosedTotals.seven.enclosed),
          },
          whiteGlove: Math.round(whiteGloveTotal * share),
        },
      },
    };
  });

  return {
    _id: id,
    refId,
    status: opts.status,
    companyName: demoPortal.companyName,
    portal: {
      _id: DEMO_PORTAL_ID,
      companyName: demoPortal.companyName,
    },
    portalId: {
      _id: DEMO_PORTAL_ID,
      companyName: demoPortal.companyName,
      logo: null,
    },
    user: {
      _id: agent._id,
      firstName: agent.firstName,
      lastName: agent.lastName,
    },
    userId: {
      _id: agent._id,
      firstName: agent.firstName,
      lastName: agent.lastName,
    },
    customer: {
      name: opts.customerName,
      firstName: opts.customerName.split(" ")[0],
      lastName: opts.customerName.split(" ").slice(1).join(" ") || "Customer",
      email: opts.email,
      phone: opts.phone,
      quoteConfirmationCode: `HZ${refId}`,
      trackingCode: `HZ${refId}`,
    },
    origin: quoteLocation(origin.city, origin.state),
    destination: quoteLocation(destination.city, destination.state),
    miles,
    transportType,
    transitTime,
    vehicles,
    totalPricing: {
      modifiers: {
        commission: commissionPerVehicle,
        companyTariff: tariffPerVehicle,
      },
      totals: {
        ...openEnclosedTotals,
        whiteGlove: whiteGloveTotal,
      },
    },
    createdAt: daysAgo(opts.daysAgoCreated),
  };
}

export const DEMO_PORTALS = [demoPortal];
/** All demo portals (primary only for portal-admin POV lists). */
export const DEMO_PORTALS_ALL = [demoPortal, demoPortalB];

export const DEMO_USERS = [demoUserAdmin, demoUserAgent, demoUserAgentB];

export const DEMO_ORDERS = [
  buildOrder(DEMO_ORDER_IDS[0], 90001, {
    customerName: "Casey Morgan",
    email: "casey.morgan@example.com",
    phone: "(617) 555-0142",
    status: "booked",
    daysAgoCreated: 2,
    reg: "4829173",
    miles: 1960,
    serviceLevel: 5,
    vehicles: [
      vehicle(2021, "Honda", "Accord", 1295, {
        pricingClass: "sedan",
        vin: "1HGCV1F34MA084217",
      }),
    ],
    origin: {
      city: "Boston",
      state: "MA",
      zip: "02108",
      street: "100 Beacon St",
      locationType: "residence",
    },
    destination: {
      city: "Austin",
      state: "TX",
      zip: "78701",
      street: "200 Congress Ave",
      locationType: "residence",
    },
  }),
  buildOrder(DEMO_ORDER_IDS[1], 90002, {
    customerName: "Riley Quinn",
    email: "riley.quinn@example.com",
    phone: "(312) 555-0198",
    status: "booked",
    paymentType: "COD",
    daysAgoCreated: 4,
    reg: "5192840",
    miles: 1000,
    serviceLevel: 3,
    vehicles: [
      vehicle(2020, "Ford", "Escape", 980, {
        pricingClass: "suv",
        vin: "1FMCU9G60LUA45231",
      }),
    ],
    origin: {
      city: "Chicago",
      state: "IL",
      zip: "60611",
      street: "505 N Michigan Ave",
      locationType: "dealership",
      companyName: "Lakeshore Ford",
    },
    destination: {
      city: "Denver",
      state: "CO",
      zip: "80202",
      street: "1600 Blake St",
      locationType: "residence",
    },
  }),
  buildOrder(DEMO_ORDER_IDS[2], 90003, {
    customerName: "Taylor Brooks",
    email: "taylor.brooks@example.com",
    phone: "(206) 555-0133",
    status: "booked",
    daysAgoCreated: 8,
    pickupCompleted: true,
    reg: "6034418",
    miles: 1425,
    serviceLevel: 4,
    vehicles: [
      vehicle(2019, "Chevrolet", "Silverado", 1540, {
        pricingClass: "pickup_4_doors",
        vin: "3GCUYDED5KG123849",
      }),
    ],
    origin: {
      city: "Seattle",
      state: "WA",
      zip: "98101",
      street: "1201 2nd Ave",
      locationType: "residence",
    },
    destination: {
      city: "Phoenix",
      state: "AZ",
      zip: "85004",
      street: "1 E Washington St",
      locationType: "residence",
    },
  }),
  buildOrder(DEMO_ORDER_IDS[3], 90004, {
    customerName: "Jamie Nguyen",
    email: "jamie.nguyen@example.com",
    phone: "(214) 555-0177",
    status: "complete",
    daysAgoCreated: 20,
    pickupCompleted: true,
    deliveryCompleted: true,
    reg: "4478129",
    miles: 780,
    serviceLevel: 3,
    vehicles: [
      vehicle(2022, "Mazda", "CX-5", 1120, {
        pricingClass: "suv",
        vin: "JM3KFBDM5N0418823",
      }),
    ],
    origin: {
      city: "Dallas",
      state: "TX",
      zip: "75201",
      street: "2200 Ross Ave",
      locationType: "residence",
    },
    destination: {
      city: "Atlanta",
      state: "GA",
      zip: "30303",
      street: "50 Hurt Plaza SE",
      locationType: "dealership",
      companyName: "Peachtree Mazda",
    },
  }),
  buildOrder(DEMO_ORDER_IDS[4], 90005, {
    customerName: "Morgan Ellis",
    email: "morgan.ellis@example.com",
    phone: "(503) 555-0164",
    status: "booked",
    daysAgoCreated: 1,
    reg: "7782301",
    miles: 1085,
    serviceLevel: 3,
    transportType: "ENCLOSED",
    agent: demoUserAgentB,
    vehicles: [
      vehicle(2023, "BMW", "330i", 975, {
        pricingClass: "sedan",
        vin: "WBA5R1C05PFW92841",
      }),
      vehicle(2022, "Tesla", "Model Y", 700, {
        pricingClass: "suv",
        vin: "5YJYGDEE3NF294017",
      }),
    ],
    origin: {
      city: "Portland",
      state: "OR",
      zip: "97204",
      street: "1000 SW Broadway",
      locationType: "residence",
    },
    destination: {
      city: "San Diego",
      state: "CA",
      zip: "92101",
      street: "600 B St",
      locationType: "residence",
    },
  }),
  buildOrder(DEMO_ORDER_IDS[5], 90006, {
    customerName: "Avery Chen",
    email: "avery.chen@example.com",
    phone: "(612) 555-0119",
    status: "complete",
    daysAgoCreated: 30,
    pickupCompleted: true,
    deliveryCompleted: true,
    reg: "3910572",
    miles: 880,
    serviceLevel: 5,
    vehicles: [
      vehicle(2018, "Toyota", "Corolla", 890, {
        pricingClass: "sedan",
        vin: "2T1BURHE5JC094512",
      }),
    ],
    origin: {
      city: "Minneapolis",
      state: "MN",
      zip: "55401",
      street: "225 S 6th St",
      locationType: "residence",
    },
    destination: {
      city: "Nashville",
      state: "TN",
      zip: "37203",
      street: "501 Broadway",
      locationType: "residence",
    },
  }),
  buildOrder(DEMO_ORDER_IDS[6], 90007, {
    customerName: "Drew Santos",
    email: "drew.santos@example.com",
    phone: "(313) 555-0188",
    status: "booked",
    paymentType: "COD",
    daysAgoCreated: 6,
    pickupCompleted: true,
    reg: "5560194",
    miles: 640,
    serviceLevel: 3,
    vehicles: [
      vehicle(2017, "Jeep", "Grand Cherokee", 1420, {
        pricingClass: "suv",
        operable: false,
        vin: "1C4RJFAG5HC812394",
      }),
    ],
    origin: {
      city: "Detroit",
      state: "MI",
      zip: "48226",
      street: "400 Renaissance Center",
      locationType: "auction",
      companyName: "Motor City Auto Auction",
    },
    destination: {
      city: "Charlotte",
      state: "NC",
      zip: "28202",
      street: "100 N Tryon St",
      locationType: "residence",
    },
  }),
  buildOrder(DEMO_ORDER_IDS[7], 90008, {
    customerName: "Parker Kim",
    email: "parker.kim@example.com",
    phone: "(212) 555-0155",
    status: "booked",
    daysAgoCreated: 3,
    reg: "8204476",
    miles: 2790,
    serviceLevel: 1,
    transportType: "WHITEGLOVE",
    vehicles: [
      vehicle(2022, "Mercedes-Benz", "C-Class", 2010, {
        pricingClass: "sedan",
        vin: "W1KAF4HB1NR145892",
      }),
    ],
    origin: {
      city: "New York",
      state: "NY",
      zip: "10001",
      street: "350 5th Ave",
      locationType: "dealership",
      companyName: "Manhattan Mercedes",
    },
    destination: {
      city: "Los Angeles",
      state: "CA",
      zip: "90012",
      street: "200 N Spring St",
      locationType: "residence",
    },
  }),
  buildOrder(DEMO_ORDER_IDS[8], 90009, {
    customerName: "Nora Hale",
    email: "nora.hale@example.com",
    phone: "(215) 555-0126",
    status: "complete",
    daysAgoCreated: 45,
    pickupCompleted: true,
    deliveryCompleted: true,
    reg: "2749183",
    miles: 1550,
    serviceLevel: 4,
    vehicles: [
      vehicle(2021, "Ram", "1500", 780, {
        pricingClass: "pickup_4_doors",
        vin: "1C6SRFFT5MN543210",
      }),
      vehicle(2016, "Honda", "Civic", 550, {
        pricingClass: "sedan",
        vin: "19XFC2F59GE214567",
      }),
    ],
    origin: {
      city: "Philadelphia",
      state: "PA",
      zip: "19103",
      street: "1700 Market St",
      locationType: "residence",
    },
    destination: {
      city: "Houston",
      state: "TX",
      zip: "77002",
      street: "901 Bagby St",
      locationType: "residence",
    },
  }),
  buildOrder(DEMO_ORDER_IDS[9], 90010, {
    customerName: "Reese Patel",
    email: "reese.patel@example.com",
    phone: "(801) 555-0149",
    status: "booked",
    daysAgoCreated: 5,
    reg: "6391057",
    miles: 1070,
    serviceLevel: 3,
    vehicles: [
      vehicle(2019, "Volkswagen", "Golf", 1185, {
        pricingClass: "sedan",
        vin: "3VW5T7AU5KM012348",
      }),
    ],
    origin: {
      city: "Salt Lake City",
      state: "UT",
      zip: "84101",
      street: "15 W South Temple",
      locationType: "residence",
    },
    destination: {
      city: "Kansas City",
      state: "MO",
      zip: "64105",
      street: "414 E 12th St",
      locationType: "residence",
    },
  }),
];

export const DEMO_QUOTES = [
  buildQuote(DEMO_QUOTE_IDS[0], 80001, {
    customerName: "Harper Wells",
    email: "harper.wells@example.com",
    phone: "(773) 555-0181",
    status: "active",
    daysAgoCreated: 1,
    vehicles: [
      vehicle(2021, "Honda", "CR-V", 1050, {
        pricingClass: "suv",
        vin: "2HKRW2H86MH612340",
      }),
    ],
    route: {
      origin: { city: "Chicago", state: "IL" },
      destination: { city: "Denver", state: "CO" },
      miles: 1000,
      transitTime: [3, 5],
    },
  }),
  buildQuote(DEMO_QUOTE_IDS[1], 80002, {
    customerName: "Logan Price",
    email: "logan.price@example.com",
    phone: "(425) 555-0172",
    status: "active",
    daysAgoCreated: 3,
    vehicles: [
      vehicle(2019, "Ford", "F-150", 700, {
        pricingClass: "pickup_4_doors",
        vin: "1FTEW1E49KFA20451",
      }),
      vehicle(2020, "Tesla", "Model 3", 525, {
        pricingClass: "sedan",
        vin: "5YJ3E1EA5LF612903",
      }),
    ],
    route: {
      origin: { city: "Seattle", state: "WA" },
      destination: { city: "Phoenix", state: "AZ" },
      miles: 1420,
      transitTime: [4, 6],
    },
  }),
  buildQuote(DEMO_QUOTE_IDS[2], 80003, {
    customerName: "Casey Morgan",
    email: "casey.morgan@example.com",
    phone: "(617) 555-0142",
    status: "booked",
    daysAgoCreated: 2,
    transportType: "WHITEGLOVE",
    vehicles: [
      vehicle(2023, "BMW", "X5", 1895, {
        pricingClass: "suv",
        vin: "5UXCR6C05P9S44102",
      }),
    ],
    route: {
      origin: { city: "Boston", state: "MA" },
      destination: { city: "Miami", state: "FL" },
      miles: 1490,
      transitTime: [4, 7],
    },
  }),
  buildQuote(DEMO_QUOTE_IDS[3], 80004, {
    customerName: "Skyler Adams",
    email: "skyler.adams@example.com",
    phone: "(469) 555-0138",
    status: "active",
    daysAgoCreated: 5,
    vehicles: [
      vehicle(2018, "Jeep", "Wrangler", 980, {
        pricingClass: "suv",
        operable: false,
        vin: "1C4HJXDG5JW184203",
      }),
    ],
    route: {
      origin: { city: "Dallas", state: "TX" },
      destination: { city: "Atlanta", state: "GA" },
      miles: 780,
      transitTime: [2, 4],
    },
  }),
  buildQuote(DEMO_QUOTE_IDS[4], 80005, {
    customerName: "Quinn Foster",
    email: "quinn.foster@example.com",
    phone: "(971) 555-0190",
    status: "expired",
    daysAgoCreated: 20,
    vehicles: [
      vehicle(2017, "Subaru", "Outback", 550, {
        pricingClass: "suv",
        vin: "4S4BSAFC5H3341209",
      }),
      vehicle(2016, "Toyota", "Prius", 550, {
        pricingClass: "sedan",
        vin: "JTDKARFU9G3124587",
      }),
    ],
    route: {
      origin: { city: "Portland", state: "OR" },
      destination: { city: "San Diego", state: "CA" },
      miles: 1085,
      transitTime: [3, 5],
    },
  }),
  buildQuote(DEMO_QUOTE_IDS[5], 80006, {
    customerName: "Blake Turner",
    email: "blake.turner@example.com",
    phone: "(646) 555-0144",
    status: "active",
    daysAgoCreated: 0,
    transportType: "WHITEGLOVE",
    agent: demoUserAgentB,
    vehicles: [
      vehicle(2022, "Porsche", "911", 1450, {
        pricingClass: "coupe",
        vin: "WP0AB2A99NS221458",
      }),
      vehicle(2021, "Audi", "A4", 600, {
        pricingClass: "sedan",
        vin: "WAUENAF41MN048291",
      }),
      vehicle(2015, "Honda", "Civic", 400, {
        pricingClass: "sedan",
        operable: false,
        vin: "19XFB2F58FE204871",
      }),
    ],
    route: {
      origin: { city: "New York", state: "NY" },
      destination: { city: "Los Angeles", state: "CA" },
      miles: 2790,
      transitTime: [7, 10],
    },
  }),
  buildQuote(DEMO_QUOTE_IDS[6], 80007, {
    customerName: "Finley Shaw",
    email: "finley.shaw@example.com",
    phone: "(763) 555-0166",
    status: "active",
    daysAgoCreated: 7,
    transportType: "ENCLOSED",
    vehicles: [
      vehicle(2020, "Chevrolet", "Equinox", 1120, {
        pricingClass: "suv",
        vin: "2GNAXSEV5L6142093",
      }),
    ],
    route: {
      origin: { city: "Minneapolis", state: "MN" },
      destination: { city: "Nashville", state: "TN" },
      miles: 880,
      transitTime: [2, 4],
    },
  }),
  buildQuote(DEMO_QUOTE_IDS[7], 80008, {
    customerName: "Riley Quinn",
    email: "riley.quinn@example.com",
    phone: "(312) 555-0198",
    status: "booked",
    daysAgoCreated: 4,
    vehicles: [
      vehicle(2024, "Rivian", "R1T", 520, {
        pricingClass: "pickup_4_doors",
        vin: "7FCTGAAA5PN012384",
      }),
      vehicle(2019, "Volkswagen", "Golf", 460, {
        pricingClass: "sedan",
        vin: "3VW5T7AU8KM048217",
      }),
    ],
    route: {
      origin: { city: "Detroit", state: "MI" },
      destination: { city: "Charlotte", state: "NC" },
      miles: 640,
      transitTime: [2, 3],
    },
  }),
  buildQuote(DEMO_QUOTE_IDS[8], 80009, {
    customerName: "Emerson Gray",
    email: "emerson.gray@example.com",
    phone: "(267) 555-0151",
    status: "active",
    daysAgoCreated: 2,
    transportType: "WHITEGLOVE",
    vehicles: [
      vehicle(2022, "Mercedes-Benz", "GLE", 2200, {
        pricingClass: "suv",
        vin: "4JGFB4KB5NA245871",
      }),
    ],
    route: {
      origin: { city: "Philadelphia", state: "PA" },
      destination: { city: "Houston", state: "TX" },
      miles: 1550,
      transitTime: [4, 6],
    },
  }),
  buildQuote(DEMO_QUOTE_IDS[9], 80010, {
    customerName: "Hayden Cole",
    email: "hayden.cole@example.com",
    phone: "(385) 555-0123",
    status: "active",
    daysAgoCreated: 6,
    vehicles: [
      vehicle(2014, "Nissan", "Altima", 400, {
        pricingClass: "sedan",
        vin: "1N4AL3AP3EC184029",
      }),
      vehicle(2023, "Hyundai", "Tucson", 425, {
        pricingClass: "suv",
        vin: "5NMJE3AE5PH214583",
      }),
      vehicle(2018, "Mazda", "CX-5", 350, {
        pricingClass: "suv",
        vin: "JM3KFBDM2J0412983",
      }),
    ],
    route: {
      origin: { city: "Salt Lake City", state: "UT" },
      destination: { city: "Kansas City", state: "MO" },
      miles: 1070,
      transitTime: [3, 5],
    },
  }),
];

/** Persona returned for GET /user while Demo Mode is active (portal admin POV). */
export function getDemoAuthorizedUser() {
  return { ...demoUserAdmin };
}

export function getDemoPortalById(portalId: string) {
  return DEMO_PORTALS_ALL.find((p) => String(p._id) === String(portalId));
}

export function getDemoOrderById(orderId: string) {
  return DEMO_ORDERS.find((o) => String(o._id) === String(orderId));
}

export function getDemoQuoteById(quoteId: string) {
  return DEMO_QUOTES.find((q) => String(q._id) === String(quoteId));
}

export function getDemoUserById(userId: string) {
  return DEMO_USERS.find((u) => String(u._id) === String(userId));
}

export function getDemoOrdersList() {
  return {
    orders: DEMO_ORDERS,
    orderCount: DEMO_ORDERS.length,
  };
}

export function getDemoQuotesList() {
  return {
    quotes: DEMO_QUOTES,
    quoteCount: DEMO_QUOTES.length,
  };
}

export function getDemoAnalytics() {
  let mccollisters_rate = 0;
  let company_tariff = 0;
  let commission = 0;
  let total_price = 0;
  let orderCount = 0;
  DEMO_ORDERS.filter((o) => o.paymentType !== "COD").forEach((order) => {
    orderCount += 1;
    mccollisters_rate += order.totalPricing?.total || 0;
    total_price += order.totalPricing?.totalWithCompanyTariffAndCommission || 0;
    order.vehicles?.forEach((v: any) => {
      commission += v.pricing?.modifiers?.commission || 0;
      company_tariff += v.pricing?.modifiers?.companyTariff || 0;
    });
  });
  return {
    mccollisters_rate,
    company_tariff,
    commission,
    total_price,
    orderCount,
  };
}

export function getDemoCodOrders() {
  return DEMO_ORDERS.filter((o) => o.paymentType === "COD");
}

export function getDemoCommissionReports() {
  return [
    {
      userId: demoUserAgent._id,
      firstName: demoUserAgent.firstName,
      lastName: demoUserAgent.lastName,
      email: demoUserAgent.email,
      orderCount: 5,
      commission: 125,
      total: 6500,
    },
    {
      userId: demoUserAgentB._id,
      firstName: demoUserAgentB.firstName,
      lastName: demoUserAgentB.lastName,
      email: demoUserAgentB.email,
      orderCount: 3,
      commission: 75,
      total: 3900,
    },
  ];
}

export function getDemoSurveySummary() {
  return [
    {
      portalId: DEMO_PORTAL_ID,
      companyName: demoPortal.companyName,
      averageRating: 4.6,
      responseCount: 12,
    },
  ];
}
