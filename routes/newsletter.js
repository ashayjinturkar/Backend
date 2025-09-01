const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const nodemailer = require('nodemailer');
const { NewsletterSubscriber, NewsletterUpload, NewsletterCampaign } = require('../models/Newsletter');

const router = express.Router();

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'newsletters');
    fs.ensureDirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'newsletter-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for PDFs
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

// Configure nodemailer (you'll need to set up your email service)
const createTransporter = () => {
  return nodemailer.createTransporter({
    // Configure your email service here
    // Example for Gmail:
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
    // Or use SMTP settings for other providers
  });
};

// SUBSCRIBER ROUTES

// GET /api/newsletter/subscribers - Get all subscribers
router.get('/subscribers', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      unsubscribed,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    // Add filters
    if (unsubscribed !== undefined) query.unsubscribed = unsubscribed === 'true';
    
    // Add search functionality
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    };

    const subscribers = await NewsletterSubscriber.find(query)
      .sort(options.sort)
      .limit(options.limit * 1)
      .skip((options.page - 1) * options.limit)
      .exec();

    // For compatibility with frontend, return array directly
    res.json(subscribers);

  } catch (error) {
    console.error('Error fetching newsletter subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch newsletter subscribers' });
  }
});

// POST /api/newsletter/subscribers - Add new subscriber
router.post('/subscribers', async (req, res) => {
  try {
    const { email, name, source = 'website' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if subscriber already exists
    const existingSubscriber = await NewsletterSubscriber.findOne({ email });
    
    if (existingSubscriber) {
      if (existingSubscriber.unsubscribed) {
        // Resubscribe if they were previously unsubscribed
        existingSubscriber.unsubscribed = false;
        existingSubscriber.unsubscribedAt = null;
        await existingSubscriber.save();
        
        return res.json({
          message: 'Successfully resubscribed to newsletter',
          subscriber: existingSubscriber
        });
      } else {
        return res.status(400).json({ error: 'Email is already subscribed' });
      }
    }

    const subscriber = new NewsletterSubscriber({
      email,
      name,
      source
    });

    await subscriber.save();

    res.status(201).json({
      message: 'Successfully subscribed to newsletter',
      subscriber
    });

  } catch (error) {
    console.error('Error adding newsletter subscriber:', error);
    res.status(500).json({ 
      error: 'Failed to add newsletter subscriber',
      details: error.message 
    });
  }
});

// PUT /api/newsletter/subscribers/:id/unsubscribe - Unsubscribe user
router.put('/subscribers/:id/unsubscribe', async (req, res) => {
  try {
    const subscriber = await NewsletterSubscriber.findByIdAndUpdate(
      req.params.id,
      { 
        unsubscribed: true,
        unsubscribedAt: new Date()
      },
      { new: true }
    );

    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    res.json({
      message: 'Subscriber unsubscribed successfully',
      subscriber
    });

  } catch (error) {
    console.error('Error unsubscribing user:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid subscriber ID' });
    }
    res.status(500).json({ error: 'Failed to unsubscribe user' });
  }
});

// DELETE /api/newsletter/subscribers/:id - Delete subscriber
router.delete('/subscribers/:id', async (req, res) => {
  try {
    const subscriber = await NewsletterSubscriber.findByIdAndDelete(req.params.id);
    
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    res.json({
      message: 'Subscriber deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting subscriber:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid subscriber ID' });
    }
    res.status(500).json({ error: 'Failed to delete subscriber' });
  }
});

// NEWSLETTER SENDING ROUTES

// POST /api/newsletter/send - Send newsletter
router.post('/send', async (req, res) => {
  try {
    const { subject, content, sendTo, subscriberIds } = req.body;

    if (!subject || !content) {
      return res.status(400).json({ error: 'Subject and content are required' });
    }

    let recipients = [];
    
    // Determine recipients based on sendTo parameter
    if (sendTo === 'all') {
      recipients = await NewsletterSubscriber.find({ unsubscribed: false });
    } else if (sendTo === 'selected' && subscriberIds) {
      recipients = await NewsletterSubscriber.find({ 
        _id: { $in: subscriberIds },
        unsubscribed: false 
      });
    } else if (sendTo === 'unsubscribed') {
      recipients = await NewsletterSubscriber.find({ unsubscribed: true });
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients found' });
    }

    // Create campaign record
    const campaign = new NewsletterCampaign({
      subject,
      content,
      sentTo,
      recipientCount: recipients.length
    });

    // In a real implementation, you would:
    // 1. Set up a proper email service (SendGrid, Mailgun, etc.)
    // 2. Send emails in batches to avoid rate limits
    // 3. Handle bounces and delivery status
    // 4. Queue emails for background processing

    // For now, we'll simulate sending
    try {
      // Simulate email sending (replace with actual implementation)
      console.log(`Simulating sending newsletter to ${recipients.length} recipients`);
      console.log('Subject:', subject);
      console.log('Content preview:', content.substring(0, 100) + '...');
      
      // Update campaign status
      campaign.status = 'sent';
      campaign.deliveryStats.delivered = recipients.length;
      
      await campaign.save();

      res.json({
        message: `Newsletter sent successfully to ${recipients.length} recipients`,
        campaign: {
          id: campaign._id,
          recipientCount: campaign.recipientCount,
          sentAt: campaign.sentAt
        }
      });

    } catch (emailError) {
      campaign.status = 'failed';
      await campaign.save();
      throw emailError;
    }

  } catch (error) {
    console.error('Error sending newsletter:', error);
    res.status(500).json({ 
      error: 'Failed to send newsletter',
      details: error.message 
    });
  }
});

// NEWSLETTER UPLOAD ROUTES

// GET /api/newsletter/uploads - Get uploaded newsletters
router.get('/uploads', async (req, res) => {
  try {
    const newsletters = await NewsletterUpload.find({ active: true })
      .sort({ createdAt: -1 });

    res.json(newsletters);

  } catch (error) {
    console.error('Error fetching uploaded newsletters:', error);
    res.status(500).json({ error: 'Failed to fetch uploaded newsletters' });
  }
});

// POST /api/newsletter/upload - Upload newsletter PDF
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const { name, category, date } = req.body;

    if (!name || !category || !date) {
      return res.status(400).json({ 
        error: 'Name, category, and date are required' 
      });
    }

    const newsletter = new NewsletterUpload({
      name,
      category,
      date: new Date(date),
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileSize: req.file.size
    });

    await newsletter.save();

    res.status(201).json({
      message: 'Newsletter uploaded successfully',
      newsletter
    });

  } catch (error) {
    console.error('Error uploading newsletter:', error);
    res.status(500).json({ 
      error: 'Failed to upload newsletter',
      details: error.message 
    });
  }
});

// DELETE /api/newsletter/uploads/:id - Delete uploaded newsletter
router.delete('/uploads/:id', async (req, res) => {
  try {
    const newsletter = await NewsletterUpload.findById(req.params.id);
    
    if (!newsletter) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }

    // Delete the PDF file
    const filePath = path.join(__dirname, '..', 'uploads', 'newsletters', newsletter.filename);
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }

    await NewsletterUpload.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Newsletter deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting newsletter:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid newsletter ID' });
    }
    res.status(500).json({ error: 'Failed to delete newsletter' });
  }
});

// GET /api/newsletter/uploads/:id/download - Download newsletter (increment counter)
router.get('/uploads/:id/download', async (req, res) => {
  try {
    const newsletter = await NewsletterUpload.findById(req.params.id);
    
    if (!newsletter) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }

    // Increment download counter
    newsletter.downloadCount += 1;
    await newsletter.save();

    const filePath = path.join(__dirname, '..', 'uploads', 'newsletters', newsletter.filename);
    
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, newsletter.originalName);

  } catch (error) {
    console.error('Error downloading newsletter:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid newsletter ID' });
    }
    res.status(500).json({ error: 'Failed to download newsletter' });
  }
});

// ANALYTICS ROUTES

// GET /api/newsletter/stats - Get newsletter statistics
router.get('/stats', async (req, res) => {
  try {
    const [
      totalSubscribers,
      activeSubscribers,
      unsubscribedCount,
      totalCampaigns,
      totalUploads
    ] = await Promise.all([
      NewsletterSubscriber.countDocuments(),
      NewsletterSubscriber.countDocuments({ unsubscribed: false }),
      NewsletterSubscriber.countDocuments({ unsubscribed: true }),
      NewsletterCampaign.countDocuments(),
      NewsletterUpload.countDocuments({ active: true })
    ]);

    res.json({
      totalSubscribers,
      activeSubscribers,
      unsubscribedCount,
      totalCampaigns,
      totalUploads,
      subscriptionRate: totalSubscribers > 0 ? 
        ((activeSubscribers / totalSubscribers) * 100).toFixed(2) : 0
    });

  } catch (error) {
    console.error('Error fetching newsletter statistics:', error);
    res.status(500).json({ error: 'Failed to fetch newsletter statistics' });
  }
});

module.exports = router;