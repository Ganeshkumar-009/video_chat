const express = require('express');
const supabase = require('../config/supabase');
const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ message: "Search query required" });

    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, status')
      .ilike('username', `%${query}%`);

    if (error) throw error;

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Search failed" });
  }
});

module.exports = router;
