const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Fields required" });

    // Check if user already exists in 'users' table
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase())
      .single();

    if (existingUser) {
      return res.status(400).json({ message: "Username is already taken." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ username: username.toLowerCase(), password: hashedPassword }])
      .select()
      .single();

    if (insertError) throw insertError;

    res.status(201).json({ message: "User created successfully!", id: newUser.id, username: newUser.username });
  } catch (error) {
    console.error(error);
    const msg = error.message || "";
    const isTableMissing = msg.includes('schema cache') || msg.includes('relation "users" does not exist');
    res.status(500).json({ message: isTableMissing ? "Database tables not found. Please run the SQL setup script in Supabase." : "Authentication failed" });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase())
      .single();

    if (!user || fetchError) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error(error);
    const msg = error.message || "";
    const isTableMissing = msg.includes('schema cache') || msg.includes('relation "users" does not exist');
    res.status(500).json({ message: isTableMissing ? "Database tables not found. Please run the SQL setup script in Supabase." : "Authentication failed" });
  }
});

module.exports = router;
