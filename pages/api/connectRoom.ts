// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
// const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const authToken = process.env.TWILIO_AUTH_TOKEN;
// const client = require("twilio")(accountSid, authToken);
const AccessToken = require("twilio").jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioApiKey = process.env.TWILIO_API_KEY;
const twilioApiSecret = process.env.TWILIO_API_SECRET;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(JSON.parse(req.body));

  const items = JSON.parse(req.body);
  const videoGrant = new VideoGrant({
    room: items.roomName,
  });
  const token = new AccessToken(
    twilioAccountSid,
    twilioApiKey,
    twilioApiSecret,
    { identity: items.userName }
  );
  token.addGrant(videoGrant);

  res.status(200).json({ token: token.toJwt(), roomName: items.roomName });
}
