// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const create = async () => {
    await client.video.v1.rooms
      .create({ uniqueName: "DailyStandup" })
      .then((room: any) => console.log(room.sid));
  };
  create();
  res.status(200).json({ token: "" });
}
