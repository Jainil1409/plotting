export type PropertyDetails = {
  name: string;
  bhk: string;
  area: number;
  price: string;
};

export type PropertyDetailsByModelInstance = Record<string, Record<string, PropertyDetails>>;

export const PROPERTY_DETAILS: PropertyDetailsByModelInstance = {
  "house-main": {
    Mesh5_Metal_Silver_0: { name: "Plot A", bhk: "2 BHK", area: 1240, price: "Rs 68 Lakh" },
  },
};
