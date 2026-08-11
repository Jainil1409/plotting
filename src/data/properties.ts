export type PropertyDetails = {
  name: string;
  bhk: string;
  area: number;
  price: string;
};

export type PropertyDetailsByModelInstance = Record<string, Record<string, PropertyDetails>>;

export const PROPERTY_DETAILS: PropertyDetailsByModelInstance = {
  "house-main": {
    Object_2: { name: "Plot A", bhk: "2 BHK", area: 1240, price: "Rs 68 Lakh" },
    Object_3: { name: "Plot B", bhk: "3 BHK", area: 1680, price: "Rs 92 Lakh" },
    Object_4: { name: "Plot C", bhk: "2 BHK", area: 1320, price: "Rs 74 Lakh" },
    Object_5: { name: "Plot D", bhk: "3 BHK", area: 1760, price: "Rs 98 Lakh" },
    Object_6: { name: "Plot E", bhk: "4 BHK", area: 2210, price: "Rs 1.24 Cr" },
    Object_7: { name: "Plot F", bhk: "4 BHK", area: 2300, price: "Rs 1.28 Cr" },
    Object_8: { name: "Plot G", bhk: "3 BHK", area: 1800, price: "Rs 1.02 Cr" },
    Object_9: { name: "Plot H", bhk: "2 BHK", area: 1400, price: "Rs 78 Lakh" },
    Object_10: { name: "Plot I", bhk: "3 BHK", area: 1720, price: "Rs 95 Lakh" },
    Object_11: { name: "Plot J", bhk: "4 BHK", area: 2380, price: "Rs 1.32 Cr" },
    Object_12: { name: "Plot K", bhk: "3 BHK", area: 1780, price: "Rs 99 Lakh" },
    Object_13: { name: "Plot L", bhk: "2 BHK", area: 1300, price: "Rs 72 Lakh" },
    Object_14: { name: "Plot M", bhk: "4 BHK", area: 2400, price: "Rs 1.34 Cr" },
    Object_15: { name: "Plot N", bhk: "3 BHK", area: 1820, price: "Rs 1.04 Cr" },
    Object_16: { name: "Plot O", bhk: "2 BHK", area: 1340, price: "Rs 76 Lakh" },
    Object_17: { name: "Plot P", bhk: "4 BHK", area: 2420, price: "Rs 1.36 Cr" },
  },
};
