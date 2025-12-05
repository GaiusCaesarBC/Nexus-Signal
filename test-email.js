// Quick SendGrid test - run with: node test-email.js
require('dotenv').config();

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
    to: 'abaker@nexussignal.ai', // Change this to YOUR email to receive the test
    from: process.env.EMAIL_FROM || 'security@nexussignal.ai',
    subject: 'SendGrid Test - Nexus Signal',
    text: 'If you received this, SendGrid is working!',
    html: '<h1>SendGrid Works!</h1><p>Your 2FA emails will work correctly.</p>',
};

sgMail
    .send(msg)
    .then(() => {
        console.log('✅ Email sent successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error:', error.response?.body || error.message);
        process.exit(1);
    });
