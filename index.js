const {
  WebhookClient,
  MessageEmbed,
  MessageAttachment,
} = require("discord.js");
const MailListener = require("mail-listener3");

const dotenv = require("dotenv");
dotenv.config();

const webhookURLs = JSON.parse(process.env.WEBHOOK_URLS);
const webhooks = [];
webhookURLs.forEach((url) => {
  const webhook = new WebhookClient({ url });
  if (!webhook) {
    throw new Error("Invalid webhook URL: " + url);
  }

  webhooks.push(webhook);
});

start();

async function start() {
  const mailListener = new MailListener({
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
    host: process.env.HOST,
    port: Number(process.env.PORT),
    tls: true,
    tlsOptions: {
      rejectUnauthorized: true,
    },
    fetchUnreadOnStart: false,
    searchFilter: ["UNSEEN"],
  });
  
  const SENDERS = JSON.parse(process.env.SENDERS);
  const RECEIVERS = JSON.parse(process.env.RECEIVERS);
  mailListener.start();

  mailListener.on("server:connected", function () {
    console.log("imap connected");
  });

  mailListener.on("mailbox", function (mailbox) {
    console.log("Number of mails:", mailbox.messages.total);
  });

  mailListener.on("server:disconnected", function () {
    console.log("imap disconnected");
    console.log("imap restarting...");
    start();
  });

  mailListener.on("error", function (err) {
    console.log(err);
    console.log("imap restarting...");
    start();
  });

  mailListener.on("mail", function (mail, seqno, attributes) {
    // validation
    if (
      !SENDERS.some((v) => mail.from.some((t) => t.address.includes(v))) &&
      !RECEIVERS.some((v) => mail.to.some((t) => t.address.includes(v)))
    ) {
      console.log("invalid");
      return;
    }

    mailListener.imap.addFlags(attributes.uid, "\\Seen", (err) => {
      if (!err) {
        console.log("Email " + mail.subject + " marked as read");
      }
    });

    const embed = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle(mail.subject)
      .setDescription(mail.text.substring(0, 2000))
      .setAuthor({ name: mail.from[0].name })
      .setFooter({ text: mail.to[0].address })
      .setTimestamp();

    const file = new MessageAttachment(
      Buffer.from(mail.text, "utf-8"),
      "full_email.txt"
    );

    webhooks.forEach((webhook) =>
      webhook.send({
        content: "**Full Email**",
        embeds: [embed],
        files: [file],
      })
    );
  });
}
