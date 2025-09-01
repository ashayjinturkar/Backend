const express = require('express');
const ContactSubmission = require('../models/ContactSubmission');

const router = express.Router();

// GET /api/contact-submissions - Get all contact submissions
router.get('/', async (req, res) => {
  try {
    const submissions = await ContactSubmission.find()
      .sort({ createdAt: -1 })
      .exec();

    res.json(submissions);

  } catch (error) {
    console.error('Error fetching contact submissions:', error);
    res.status(500).json({ error: 'Failed to fetch contact submissions' });
  }
});

// GET /api/contact-submissions/:id - Get single contact submission
router.get('/:id', async (req, res) => {
  try {
    const submission = await ContactSubmission.findById(req.params.id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Contact submission not found' });
    }

    res.json(submission);

  } catch (error) {
    console.error('Error fetching contact submission:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid submission ID' });
    }
    res.status(500).json({ error: 'Failed to fetch contact submission' });
  }
});

// POST /api/contact-submissions - Create new contact submission
router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      subject,
      message,
      source = 'website',
      priority = 'medium'
    } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, email, subject, and message are required' 
      });
    }

    const submission = new ContactSubmission({
      name,
      email,
      phone,
      subject,
      message,
      source,
      priority
    });

    await submission.save();

    res.status(201).json({
      message: 'Contact submission created successfully',
      submission
    });

  } catch (error) {
    console.error('Error creating contact submission:', error);
    res.status(500).json({ 
      error: 'Failed to create contact submission',
      details: error.message 
    });
  }
});

// PUT /api/contact-submissions/:id/read - Mark submission as read/unread
router.put('/:id/read', async (req, res) => {
  try {
    const { read = true } = req.body;

    const submission = await ContactSubmission.findByIdAndUpdate(
      req.params.id,
      { read },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({ error: 'Contact submission not found' });
    }

    res.json({
      message: `Submission marked as ${read ? 'read' : 'unread'}`,
      submission
    });

  } catch (error) {
    console.error('Error updating submission read status:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid submission ID' });
    }
    res.status(500).json({ error: 'Failed to update submission read status' });
  }
});

// PUT /api/contact-submissions/:id/replied - Mark submission as replied
router.put('/:id/replied', async (req, res) => {
  try {
    const { replied = true } = req.body;

    const submission = await ContactSubmission.findByIdAndUpdate(
      req.params.id,
      { replied, read: true }, // Auto-mark as read when replied
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({ error: 'Contact submission not found' });
    }

    res.json({
      message: `Submission marked as ${replied ? 'replied' : 'not replied'}`,
      submission
    });

  } catch (error) {
    console.error('Error updating submission replied status:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid submission ID' });
    }
    res.status(500).json({ error: 'Failed to update submission replied status' });
  }
});

// PUT /api/contact-submissions/:id/priority - Update submission priority
router.put('/:id/priority', async (req, res) => {
  try {
    const { priority } = req.body;

    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ error: 'Priority must be low, medium, or high' });
    }

    const submission = await ContactSubmission.findByIdAndUpdate(
      req.params.id,
      { priority },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({ error: 'Contact submission not found' });
    }

    res.json({
      message: 'Submission priority updated',
      submission
    });

  } catch (error) {
    console.error('Error updating submission priority:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid submission ID' });
    }
    res.status(500).json({ error: 'Failed to update submission priority' });
  }
});

// DELETE /api/contact-submissions/:id - Delete contact submission
router.delete('/:id', async (req, res) => {
  try {
    const submission = await ContactSubmission.findByIdAndDelete(req.params.id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Contact submission not found' });
    }

    res.json({
      message: 'Contact submission deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting contact submission:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid submission ID' });
    }
    res.status(500).json({ error: 'Failed to delete contact submission' });
  }
});

// GET /api/contact-submissions/stats/overview - Get submission statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const [
      totalSubmissions,
      unreadSubmissions,
      todaySubmissions,
      highPrioritySubmissions
    ] = await Promise.all([
      ContactSubmission.countDocuments(),
      ContactSubmission.countDocuments({ read: false }),
      ContactSubmission.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }),
      ContactSubmission.countDocuments({ priority: 'high', read: false })
    ]);

    res.json({
      totalSubmissions,
      unreadSubmissions,
      todaySubmissions,
      highPrioritySubmissions,
      readSubmissions: totalSubmissions - unreadSubmissions
    });

  } catch (error) {
    console.error('Error fetching submission statistics:', error);
    res.status(500).json({ error: 'Failed to fetch submission statistics' });
  }
});

module.exports = router;