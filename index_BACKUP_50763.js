let express = require("express");
let app = express();
let path = require("path");
const bcrypt = require('bcrypt');
const session = require('express-session');
const port = process.env.PORT || 5500;

// Database Configuration
const knex = require("knex")({
    client: "pg",
    connection: {
        host: process.env.RDS_HOSTNAME || "awseb-e-p3hejwztvb-stack-awsebrdsdatabase-9dd6rktoa0gk.cz6qkie2wm9u.us-east-1.rds.amazonaws.com",
        user: process.env.RDS_USERNAME || "turtles",
        password: process.env.RDS_PASSWORD || "Turtle414",
        database: process.env.RDS_DB_NAME || "ebdb",
        port: process.env.RDS_PORT || "5432",
        ssl: { rejectUnauthorized: false }
    }
});

// App Configuration
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// HTTPS Redirect Middleware
app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
        return res.redirect(['https://', req.get('Host'), req.url].join(''));
    }
    next();
});

// Middleware Setup
app.use(express.static('public'));
app.use('/js', express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Configuration
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 5 * 60 * 1000 // 5 minutes
    }
}));

// Helper Functions
function calculateHours(start, end) {
    const startTime = new Date(`1970-01-01T${start}:00Z`);
    const endTime = new Date(`1970-01-01T${end}:00Z`);
    const difference = Math.floor((endTime - startTime) / (1000 * 60 * 60));
    return difference > 0 ? difference : null;
}

// Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }

        const userRole = req.session.user.role;
        
        if (allowedRoles.includes(userRole)) {
            next();
        } else {
            switch (userRole) {
                case 1:
                    res.redirect('/regular');
                    break;
                case 2:
                    res.redirect('/admin');
                    break;
                case 3:
                    res.redirect('/super-admin');
                    break;
                default:
                    res.redirect('/regular');
            }
        }
    };
};

const activityTracker = (req, res, next) => {
    if (req.session.user) {
        const now = Date.now();
        const inactiveTime = now - (req.session.lastActivity || now);
        
        if (inactiveTime > 5 * 60 * 1000) {
            req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
            console.log('Session extended for user:', req.session.user.username);
        }
        
        req.session.lastActivity = now;
    }
    next();
};

app.use(activityTracker);

// PUBLIC ROUTES
app.get("/", (req, res) => res.render("index"));
app.get("/createaccount", (req, res) => res.render("createaccount"));

app.get('/login', (req, res) => {
    if (req.session && req.session.user) {
        switch (req.session.user.role) {
            case 3:
                res.redirect('/super-admin');
                break;
            case 2:
                res.redirect('/admin');
                break;
            default:
                res.redirect('/regular');
        }
    } else {
        res.render('login');
    }
});

<<<<<<< HEAD
app.post('/submit-event-request', async (req, res) => {
    const {
        event_type,
        event_location,
        event_street,
        event_city,
        event_state,
        event_zip_code,
        event_date,
        event_start_time,
        event_end_time,
        jens_story,
        expected_10_and_under,
        expected_11_to_17,
        expected_18_and_over,
        contact_first_name,
        contact_last_name,
        contact_email,
        contact_phone_number,
        contact_preferred_communication,
        contribution,
        notes,
    } = req.body;

    console.log('Form Data:', req.body);

    try {
        await knex.transaction(async (trx) => {
            // Insert into event_contacts and extract plain integer contact_id
            const [contactIdObj] = await trx('event_contacts')
                .insert({
                    contact_first_name,
                    contact_last_name,
                    contact_email: contact_email.toLowerCase(),
                    contact_phone_number,
                    contact_preferred_communication,
                })
                .returning('contact_id');

            const contactId = contactIdObj.contact_id || contactIdObj;
            console.log('Inserted Contact ID:', contactId);

            // Calculate event total hours
            const startTime = new Date(`1970-01-01T${event_start_time}:00Z`);
            const endTime = new Date(`1970-01-01T${event_end_time}:00Z`);
            const eventTotalHours = Math.round(
                (new Date(`1970-01-01T${event_end_time}:00Z`) - new Date(`1970-01-01T${event_start_time}:00Z`)) / 
                (1000 * 60 * 60)
            );
            
            // Insert into events and extract plain integer event_id
            const [eventIdObj] = await trx('events').insert({
                contact_id: contactId,
                event_type,
                event_date,
                date_of_request: trx.raw('CURRENT_TIMESTAMP'),
                event_start_time,
                event_end_time,
                event_total_hours: eventTotalHours,
                event_location,
                event_street,
                event_city,
                event_state,
                event_zip_code,
                jens_story: jens_story === 'Yes' ? 'Y' : 'N', // Map Yes/No to Y/N
                contribution: contribution === 'Yes' ? 'Y' : 'N', // Map Yes/No to Y/N
                notes: notes || null, // Optional field
            })
            
                .returning('event_id');

            const eventId = eventIdObj.event_id || eventIdObj;
            console.log('Inserted Event ID:', eventId);

            // Insert into event_attendance
            await trx('event_attendance').insert({
                event_id: eventId,
                total_expected_attendance:
                    parseInt(expected_10_and_under) +
                    parseInt(expected_11_to_17) +
                    parseInt(expected_18_and_over),
                expected_10_and_under: parseInt(expected_10_and_under),
                expected_11_to_17: parseInt(expected_11_to_17),
                expected_18_and_over: parseInt(expected_18_and_over),
                total_actual_attendance: 0,
                actual_10_and_under: 0,
                actual_11_to_17: 0,
                actual_18_and_over: 0,
            });

            console.log('Attendance Data Inserted');
        });

        // Redirect to a thank-you page
        res.redirect('/thank-you');
    } catch (error) {
        console.error('Error processing event request:', error);
        res.status(500).send('Error processing event request. Please try again later.');
    }
});









app.post('/submit-vest-distribution', async (req, res) => {
    const {
        distribution_neighborhood,
        distribution_city,
        distribution_state,
        distribution_date,
        vests_brought,
        vests_left,
        recipients // Array of recipients { recipient_first_name, recipient_last_name, recipient_size }
    } = req.body;
=======
app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
>>>>>>> 242a08e2dd2820d06c175a763b36104cad0d5c2f

    try {
        const user = await knex('accounts')
            .select('account_username', 'account_password', 'role_id', 'account_id')
            .where({ account_username: username })
            .first();

        if (!user) {
            return res.status(401).json({ success: false, error: 'user_not_found' });
        }

        if (!user.account_password) {
            return res.status(500).json({ success: false, error: 'invalid_password' });
        }

        const validPassword = await bcrypt.compare(password, user.account_password);
            
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'invalid_password' });
        }

        let redirectUrl;
        switch (user.role_id) {
            case 3:
                redirectUrl = '/super-admin';
                break;
            case 2:
                redirectUrl = '/admin';
                break;
            default:
                redirectUrl = '/regular';
        }

        req.session.user = {
            id: user.account_id,
            username: user.account_username,
            role: user.role_id
        };

        res.json({ success: true, redirect: redirectUrl });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

app.post('/create-account', async (req, res) => {
    const {
        account_first_name,
        account_last_name,
        account_username,
        account_email,
        account_password,
    } = req.body;

    try {
        const passwordRequirements = {
            length: account_password.length >= 12,
            uppercase: /[A-Z]/.test(account_password),
            lowercase: /[a-z]/.test(account_password),
            number: /\d/.test(account_password),
        };

        if (!Object.values(passwordRequirements).every(Boolean)) {
            return res.status(400).send('Password does not meet the required criteria.');
        }

        const hashedPassword = await bcrypt.hash(account_password, 10);

        await knex.transaction(async (trx) => {
            const emailConflictQuery = trx('accounts')
                .insert({
                    account_first_name,
                    account_last_name,
                    account_username,
                    account_email: account_email.toLowerCase(),
                    account_password: hashedPassword,
                    role_id: 1,
                })
                .onConflict('account_email')
                .merge({
                    account_first_name,
                    account_last_name,
                    account_password: hashedPassword,
                });

            const usernameConflictQuery = trx('accounts')
                .insert({
                    account_first_name,
                    account_last_name,
                    account_username,
                    account_email: account_email.toLowerCase(),
                    account_password: hashedPassword,
                    role_id: 1,
                })
                .onConflict('account_username')
                .merge({
                    account_first_name,
                    account_last_name,
                    account_password: hashedPassword,
                });

            await Promise.all([emailConflictQuery, usernameConflictQuery]);
        });

        res.status(200).send('Account created successfully!');
    } catch (error) {
        console.error('Error creating account:', error);
        if (error.code === '23505') {
            const conflictField = error.detail.includes('account_email') ? 'Email' : 'Username';
            res.status(400).send(`${conflictField} is already in use. Please choose a different one.`);
        } else {
            res.status(500).send('Error creating account.');
        }
    }
});
// Fetch Admins with Pagination
app.get('/admins', async (req, res) => {
    const { page = 1, search = "" } = req.query;
    const limit = 30; // Number of admins per page
    const offset = (page - 1) * limit;

<<<<<<< HEAD
    try {
        const query = knex("accounts")
            .select("*")
            .where("account_first_name", "ilike", `%${search}%`)
            .orWhere("account_last_name", "ilike", `%${search}%`)
            .limit(limit)
            .offset(offset);

        const admins = await query;
        res.json({ admins });
    } catch (error) {
        console.error("Error fetching admins:", error);
        res.status(500).send("Error fetching admins");
    }
});

// Edit Admin - Dynamic Save
app.post('/admins/:id', async (req, res) => {
    const { id } = req.params;
    const { account_first_name, account_last_name, account_username, account_email, role_id } = req.body;

    try {
        // Validate that email and username are unique (if they are changed)
        const existingAccount = await knex('accounts')
            .select('account_id')
            .where((qb) => {
                qb.where('account_email', account_email)
                  .orWhere('account_username', account_username);
            })
            .andWhere('account_id', '!=', id);

        if (existingAccount.length > 0) {
            return res.status(400).send('Email or username already exists for another account.');
        }

        // Update the account in the database
        await knex('accounts')
            .where('account_id', id)
            .update({
                account_first_name,
                account_last_name,
                account_username,
                account_email: account_email.toLowerCase(),
                role_id: parseInt(role_id), // Ensure role_id is an integer
            });

        res.status(200).send("Admin updated successfully");
    } catch (error) {
        console.error("Error updating admin:", error);
        res.status(500).send("Error updating admin");
    }
});

// Delete Admin - Dynamic
app.delete('/admins/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await knex('accounts')
            .where({ account_id: id })
            .del();

        console.log(`Account with ID ${id} deleted successfully.`);
        res.status(200).send("Admin deleted successfully");
    } catch (error) {
        console.error('Error deleting admin:', error);
        res.status(500).send("Error deleting admin");
    }
});


// Fetch Volunteers with Pagination and Search
app.get('/volunteers', async (req, res) => {
    const { page = 1, search = "" } = req.query;
    const limit = 30; // Number of volunteers per page
    const offset = (page - 1) * limit;

    try {
        const query = knex("volunteers")
            .select("*")
            .where("volunteer_first_name", "ilike", `%${search}%`)
            .orWhere("volunteer_last_name", "ilike", `%${search}%`)
            .limit(limit)
            .offset(offset);

        const volunteers = await query;
        res.json({ volunteers });
    } catch (error) {
        console.error("Error fetching volunteers:", error);
        res.status(500).send("Error fetching volunteers");
    }
});

// Delete Volunteer
app.delete('/volunteers/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await knex("volunteers").where({ volunteer_id: id }).del();
        res.status(200).send("Volunteer deleted successfully");
    } catch (error) {
        console.error("Error deleting volunteer:", error);
        res.status(500).send("Error deleting volunteer");
    }
});


app.post('/volunteers/:id', async (req, res) => {
    const { id } = req.params;
    const {
        volunteer_first_name,
        volunteer_last_name,
        volunteer_email,
        volunteer_phone_num,
        volunteer_preferred_communication,
    } = req.body;

    try {
        await knex("volunteers")
            .where({ volunteer_id: id })
            .update({
                volunteer_first_name,
                volunteer_last_name,
                volunteer_email,
                volunteer_phone_num,
                volunteer_preferred_communication,
            });

        res.status(200).send("Volunteer updated successfully");
    } catch (error) {
        console.error("Error updating volunteer:", error);
        res.status(500).send("Error updating volunteer");
    }
});



// THIS IS FOR STRIPE TESTING:
//
//
//
const bodyParser = require('body-parser');
const stripe = require('stripe')('sk_test_your_secret_key'); // Replace with your secret key


// Middleware
app.use(bodyParser.json());

// Your existing routes
app.get('/', (req, res) => {
    res.send('Welcome to Turtle Shelter Project Backend!');
});

// Add Stripe Payment Intent Route
app.post('/create-payment-intent', async (req, res) => {
    const { amount, currency } = req.body;

    try {
        // Create a PaymentIntent with the specified amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount, // Amount in smallest currency unit (e.g., cents for USD)
            currency,
        });

        // Send the client secret to the frontend
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});
//
//
//
// END STRIPE TEST CODE

=======
// PROTECTED ROUTES
app.get("/about", isAuthenticated, (req, res) => res.render("about", { user: req.session.user }));
app.get("/distribution", isAuthenticated, (req, res) => res.render("distribution", { user: req.session.user }));
app.get("/donationform", isAuthenticated, (req, res) => res.render("donationform", { user: req.session.user }));
app.get("/eventrequest", isAuthenticated, (req, res) => res.render("eventrequest", { user: req.session.user }));
app.get("/volunteer", isAuthenticated, (req, res) => res.render("volunteer", { user: req.session.user }));
app.get("/donation", isAuthenticated, (req, res) => res.render("donation", { user: req.session.user }));
app.get("/impact", isAuthenticated, (req, res) => res.render("impact", { user: req.session.user }));
app.get("/involved", isAuthenticated, (req, res) => res.render("involved", { user: req.session.user }));
app.get("/jen", isAuthenticated, (req, res) => res.render("jen", { user: req.session.user }));

// Protected form submissions
app.post('/submit-volunteer', isAuthenticated, async (req, res) => {
    // Your existing volunteer submission logic
});

app.post('/submit-donation', isAuthenticated, async (req, res) => {
    // Your existing donation submission logic
});

app.post('/submit-vest-distribution', isAuthenticated, async (req, res) => {
    // Your existing vest distribution logic
});

// DASHBOARD ROUTES
app.get('/regular', isAuthenticated, checkRole([1, 2, 3]), (req, res) => {
    res.render('regular', { user: req.session.user });
});

app.get('/admin', isAuthenticated, checkRole([2, 3]), async (req, res) => {
    try {
        const accounts = await knex('accounts').select('*');
        const volunteers = await knex('volunteers').select('*').limit(30);
        res.render('admin', { 
            user: req.session.user,
            accounts: accounts,
            volunteers: volunteers
        });
    } catch (error) {
        console.error('Error fetching admin data:', error);
        res.status(500).send('Error loading admin dashboard');
    }
});

app.get('/super-admin', isAuthenticated, checkRole([3]), (req, res) => {
    res.render('admin-super', { user: req.session.user });
});

// Utility Routes
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/login');
    });
});

>>>>>>> 242a08e2dd2820d06c175a763b36104cad0d5c2f
app.get('/test-db', async (req, res) => {
    try {
        const result = await knex.raw('SELECT 1+1 AS result');
        res.status(200).json({ success: true, message: 'Database connected successfully!', result });
    } catch (err) {
        console.error('Database connection error:', err);
        res.status(500).json({ success: false, message: 'Failed to connect to the database', error: err.message });
    }
});

// Session timeout checker
const sessionTimeoutChecker = setInterval(() => {
    console.log('Checking for expired sessions...');
}, 5 * 60 * 1000);

// Cleanup handler
process.on('SIGTERM', () => {
    clearInterval(sessionTimeoutChecker);
});

// Catch-all route - MUST be last route
app.get('*', (req, res) => {
    if (!req.session || !req.session.user) {
        res.redirect('/login');
    } else {
        switch (req.session.user.role) {
            case 3:
                res.redirect('/super-admin');
                break;
            case 2:
                res.redirect('/admin');
                break;
            default:
                res.redirect('/regular');
        }
    }
});

app.listen(port, () => console.log("Express App has started and server is listening!"));