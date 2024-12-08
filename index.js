const express = require('express');
const expressWs = require('express-ws');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const WebSocket = require('ws');

const PORT = 3000;
const MONGO_URI = 'mongodb://localhost:27017/final'; // Replace with your MongoDB URI

const app = express();
expressWs(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'voting-app-secret',
    resave: false,
    saveUninitialized: false,
}));

// WebSocket server
const wss = new WebSocket.Server({ server: app });

// User model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);

// Poll model
const pollSchema = new mongoose.Schema({
    question: { type: String, required: true },
    options: [{ value: String, votes: Number }],
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User'}]
});
const Poll = mongoose.model('Poll', pollSchema);

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('MongoDB connected');
        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    })
    .catch(err => console.error('MongoDB connection error:', err));

// Middleware to check if user is authenticated
app.use((req, res, next) => {
    if (req.session.user) {
        res.locals.user = req.session.user;
    }
    next();
});

// Authentication routes
app.get('/login', (req, res) => {
    const user = req.session.user;
    res.render('login', {user});
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.render('login', { error: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('login', { error: 'Incorrect password' });
        }

        req.session.user = user;
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.render('login', { error: 'Login failed' });
    }
});

app.get('/signup', (req, res) => {
    const user = req.session.user;
    res.render('signup', {user});
});

app.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();

        req.session.user = user;
        res.redirect('/dashboard', {user});
    } catch (err) {
        console.error(err);
        res.render('signup', { errorMessage: 'Signup failed. Please try again' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/', async (req, res) => {
    const user = req.session.user;
    res.render('index/dashboard', {user});
});

// Dashboard route
app.get('/dashboard', async (req, res) => {
    const user = req.session.user;
    if (req.session.user) {
        const polls = await Poll.find({ createdBy: user._id });
        res.render('index/authenticatedIndex', {polls, user});
    } else {
        // User is not logged in, render the unauthenticated index page
        res.render('index/dashboard', {user});
    }
});

// Create poll route
app.get('/createpoll', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    res.render('createpoll');
});

app.post('/createpoll', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const { question, options } = req.body;
    const poll = new Poll({
        question,
        options: options.map(option => ({ value: option, votes: 0 })),
        createdBy: req.session.user._id
    });

    try {
        await poll.save();
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.render('createpoll', { error: 'Error creating poll' });
    }
});

// profile page
app.get('/profile', async (req, res) => {
    
});

// voting logic
app.post('/vote', async (req, res) => {
    
  });

// WebSocket handling
wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        const data = JSON.parse(message);

        if (data.type === 'vote') {
            const { pollId, option } = data;

            try {
                const poll = await Poll.findById(pollId);
                const optionIndex = poll.options.findIndex(opt => opt.value === option);
                poll.options[optionIndex].votes++;
                await poll.save();

                wss.clients.forEach(client => {
                    client.send(JSON.stringify({
                        type: 'pollUpdate',
                        pollId,
                        updatedPoll: poll
                    }));
                });
                }
            catch (err) {
                console.error('Error updating poll:', err);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Error processing vote'
                }));
            }
        }
    });
});