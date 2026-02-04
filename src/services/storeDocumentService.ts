import { Request } from 'express';

export const storeDocument = async (body: any) => {
  console.log("Store document called with:", body);
  return { ok: true };
};