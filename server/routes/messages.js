const express = require('express');
const supabase = require('../config/supabase');
const router = express.Router();

// GET all users who have chatted with this user
router.get('/recent/:userId', async (req, res) => {
    console.log("HIT: /recent/:userId", req.params);
    try {
        const { userId } = req.params;
        console.log("Fetching recent chats for:", userId);
        
        // Fetch all messages involving the user
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*, sender:sender_id(id, username), receiver:receiver_id(id, username)')
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Supabase Error in /recent:", error);
            throw error;
        }

        // Group by the "other" user
        const recentChats = [];
        const seenUsers = new Set();
        const unreadCounts = {};

        // Calculate unread counts first
        const { data: unreadData } = await supabase
            .from('messages')
            .select('sender_id')
            .eq('receiver_id', userId)
            .eq('is_read', false);
        
        if (unreadData) {
            unreadData.forEach(m => {
                unreadCounts[m.sender_id] = (unreadCounts[m.sender_id] || 0) + 1;
            });
        }

        messages.forEach(msg => {
            const otherUser = msg.sender_id === userId ? msg.receiver : msg.sender;
            if (otherUser && !seenUsers.has(otherUser.id)) {
                seenUsers.add(otherUser.id);
                recentChats.push({
                    id: otherUser.id,
                    username: otherUser.username,
                    status: 'offline',
                    lastMessage: msg.text,
                    timestamp: msg.created_at,
                    unreadCount: unreadCounts[otherUser.id] || 0
                });
            }
        });

        res.json(recentChats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch recent chats" });
    }
});

// Mark messages as read
router.patch('/read/:userId/:otherId', async (req, res) => {
    try {
        const { userId, otherId } = req.params;
        const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('receiver_id', userId)
            .eq('sender_id', otherId)
            .eq('is_read', false);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to mark messages as read" });
    }
});

// GET history between two users
router.get('/history/:userId/:otherId', async (req, res) => {
    console.log("HIT: /history/:userId/:otherId", req.params);
    try {
        const { userId, otherId } = req.params;
        
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`)
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

module.exports = router;
