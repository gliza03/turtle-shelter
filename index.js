let express = require("express");
let app = express();
let path = require("path");
const bcrypt = require('bcrypt');
const session = require('express-session');
const port = process.env.PORT || 5500;

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

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
        return res.redirect(['https://', req.get('Host'), req.url].join(''));
    }
    next();
});

// Update your existing static middleware if needed
app.use(express.static('public'));
app.use('/js', express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));

app.use(express.json());



// Original routes
app.get("/", (req, res) => res.render("index"));
app.get("/login", (req, res) => res.render("login"));

// New routes for additional pages
app.get("/about", (req, res) => res.render("about"));
app.get("/createaccount", (req, res) => res.render("createaccount"));
app.get("/distribution", (req, res) => res.render("distribution"));
app.get("/donationform", (req, res) => res.render("donationform"));
app.get("/eventrequest", (req, res) => res.render("eventrequest"));
app.get("/admin", (req, res) => res.render("admin"));
app.get("/volunteer", (req, res) => res.render("volunteer"));
app.get("/donation", (req, res) => res.render("donation"));
app.get("/impact", (req, res) => res.render("impact"));
app.get("/involved", (req, res) => res.render("involved"));
app.get("/jen", (req, res) => res.render("jen"));


app.post('/submit-volunteer', async (req, res) => {
    const {
        volunteer_first_name,
        volunteer_last_name,
        volunteer_email,
        volunteer_phone_num,
        volunteer_preferred_communication,
        volunteer_gender,
        volunteer_street,
        volunteer_city,
        volunteer_state,
        volunteer_zip_code,
        volunteer_sewing_level,
        volunteer_leadership,
        volunteer_ref_source,
        availability = [], // Expecting an array of { date, start, end } objects
    } = req.body;

    knex.transaction(async (trx) => {
        try {
            // Insert into 'volunteers' table
            const [result] = await trx('volunteers')
                .insert({
                    volunteer_first_name,
                    volunteer_last_name,
                    volunteer_email: volunteer_email.toLowerCase(),
                    volunteer_phone_num,
                    volunteer_preferred_communication,
                    volunteer_gender,
                    volunteer_street,
                    volunteer_city,
                    volunteer_state,
                    volunteer_zip_code,
                    volunteer_sewing_level,
                    volunteer_leadership,
                    volunteer_ref_source,
                })
                .returning('volunteer_id');

            const volunteer_id = result.volunteer_id || result;

            // Validate and insert availability rows
            const availabilityRows = availability
                .filter(({ start, end }) => calculateHours(start, end) !== null)
                .map(({ date, start, end }) => ({
                    volunteer_id,
                    volunteer_date_available: date,
                    volunteer_start_availability: start,
                    volunteer_end_availability: end,
                    volunteer_hours_available: calculateHours(start, end),
                }));

            if (availabilityRows.length > 0) {
                await trx('volunteer_availability').insert(availabilityRows);
            }

            // Commit transaction
            await trx.commit();
            res.redirect('/thank-you');
        } catch (error) {
            await trx.rollback();
            console.error('Error saving volunteer data:', error);
            res.status(500).send('Internal Server Error');
        }
    });
});

// Helper function to calculate hours
function calculateHours(start, end) {
    const startTime = new Date(`1970-01-01T${start}:00Z`);
    const endTime = new Date(`1970-01-01T${end}:00Z`);
    const difference = Math.floor((endTime - startTime) / (1000 * 60 * 60)); // Convert ms to hours
    return difference > 0 ? difference : null; // Ensure non-negative
}


app.post('/submit-donation', async (req, res) => {
    const {
        donor_first_name,
        donor_last_name,
        donor_email,
        donor_phone_num, // Optional field
        desired_donation_amount,
    } = req.body;

    try {
        // Check if donor already exists or insert a new donor
        const [donor] = await knex('donors')
            .select('donor_id')
            .where({ donor_email: donor_email.toLowerCase() });

        let donor_id;

        if (donor) {
            // Donor already exists, retrieve donor_id
            donor_id = donor.donor_id;
        } else {
            // Donor does not exist, insert into 'donors' table
            const [newDonor] = await knex('donors')
                .insert({
                    donor_first_name,
                    donor_last_name,
                    donor_email: donor_email.toLowerCase(),
                    donor_phone_num: donor_phone_num || null, // Provide null if not supplied
                })
                .returning('donor_id');

            donor_id = newDonor.donor_id || newDonor; // Handle scalar or object response
        }

        // Get the current max donation_num for this donor
        const [currentMaxDonation] = await knex('donation_info')
            .select(knex.raw('COALESCE(MAX(donation_num), 0) as max_donation_num'))
            .where({ donor_id });

        const donation_num = currentMaxDonation.max_donation_num + 1;

        // Insert into 'donation_info' table
        await knex('donation_info').insert({
            donor_id,
            desired_donation_amount: parseFloat(desired_donation_amount),
            donation_num,
            donation_date: knex.fn.now(), // Set the current date and time
        });

        res.redirect('/thank-you'); // Redirect to thank-you page
    } catch (error) {
        console.error('Error saving donation data:', error);
        res.status(500).send('An error occurred while processing your donation. Please try again later.');
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

    try {
        const trx = await knex.transaction();

        let locationId;

        // Insert or fetch the location_id for the distribution location
        const result = await trx.raw(
            `
            INSERT INTO distribution_location (distribution_neighborhood, distribution_city, distribution_state)
            VALUES (?, ?, ?)
            ON CONFLICT (distribution_neighborhood, distribution_city, distribution_state)
            DO UPDATE SET 
                distribution_neighborhood = EXCLUDED.distribution_neighborhood,
                distribution_city = EXCLUDED.distribution_city,
                distribution_state = EXCLUDED.distribution_state
            RETURNING location_id
            `,
            [distribution_neighborhood, distribution_city, distribution_state]
        );

        locationId = result.rows[0].location_id;

        // Insert vest inventory data
        const [inventoryId] = await trx('vest_inventory')
            .insert({
                distribution_date,
                vests_brought,
                vests_left,
                location_id: locationId,
            })
            .returning('inventory_id');

        // Insert recipients
        if (recipients && recipients.length > 0) {
            const recipientData = recipients.map((recipient) => ({
                recipient_first_name: recipient.recipient_first_name,
                recipient_last_name: recipient.recipient_last_name,
                recipient_size: recipient.recipient_size,
                inventory_id: inventoryId, // Associate with the vest inventory
            }));

            await trx('recipients').insert(recipientData);
        }

        // Commit transaction
        await trx.commit();

        res.status(200).send('Vest distribution data saved successfully!');
    } catch (error) {
        console.error('Error saving vest distribution data:', error);
        res.status(500).send('Error saving vest distribution data.');
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
        // Validate password
        const passwordRequirements = {
            length: account_password.length >= 12,
            uppercase: /[A-Z]/.test(account_password),
            lowercase: /[a-z]/.test(account_password),
            number: /\d/.test(account_password),
        };

        if (!Object.values(passwordRequirements).every(Boolean)) {
            return res.status(400).send('Password does not meet the required criteria.');
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(account_password, 10);

        // Insert into the database
        await knex.transaction(async (trx) => {
            // Handle `account_email` conflict
            const emailConflictQuery = trx('accounts')
                .insert({
                    account_first_name,
                    account_last_name,
                    account_username,
                    account_email: account_email.toLowerCase(),
                    account_password: hashedPassword,
                    role_id: 1,
                })
                .onConflict('account_email') // Handle conflict on email
                .merge({
                    account_first_name,
                    account_last_name,
                    account_password: hashedPassword,
                });

            // Handle `account_username` conflict
            const usernameConflictQuery = trx('accounts')
                .insert({
                    account_first_name,
                    account_last_name,
                    account_username,
                    account_email: account_email.toLowerCase(),
                    account_password: hashedPassword,
                    role_id: 1,
                })
                .onConflict('account_username') // Handle conflict on username
                .merge({
                    account_first_name,
                    account_last_name,
                    account_password: hashedPassword,
                });

            // Execute both queries
            await Promise.all([emailConflictQuery, usernameConflictQuery]);
        });

        res.status(200).send('Account created successfully!');
    } catch (error) {
        console.error('Error creating account:', error);
        if (error.code === '23505') { // Unique constraint violation
            const conflictField = error.detail.includes('account_email') ? 'Email' : 'Username';
            res.status(400).send(`${conflictField} is already in use. Please choose a different one.`);
        } else {
            res.status(500).send('Error creating account.');
        }
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

app.get('/test-db', async (req, res) => {
    try {
        // Test query to check database connection
        const result = await knex.raw('SELECT 1+1 AS result');
        console.log('Database connected:', result);
        res.status(200).json({ success: true, message: 'Database connected successfully!', result });
    } catch (err) {
        console.error('Database connection error:', err);
        res.status(500).json({ success: false, message: 'Failed to connect to the database', error: err.message });
    }
});


// Add session middleware configuration
app.use(session({
    secret: 'your-secret-key', // Change this to a secure secret
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Apply middleware to protected routes
app.get('/admin', isAuthenticated, (req, res) => {
    res.render('admin', { user: req.session.user });
});
// Login route handler
app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Find user in database
        const user = await knex('accounts')
            .select('account_username', 'account_password', 'role_id')
            .where({ account_username: username })
            .first();

        console.log('Found user:', user); // Debug log

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                error: 'user_not_found' 
            });
        }

        // Check if password exists in database
        if (!user.account_password) {
            console.error('No password hash found for user');
            return res.status(500).json({ 
                success: false, 
                error: 'invalid_password' 
            });
        }

        // Compare the plain text password with the stored hash
        const validPassword = await bcrypt.compare(password, user.account_password);
        console.log('Password valid:', validPassword); // Debug log
            
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                error: 'invalid_password' 
            });
        }

        // Set user session
        req.session.user = {
            id: user.account_id,
            username: user.account_username,
            role: user.role_id
        };

        res.json({ 
            success: true,
            role: user.role_id
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'server_error' 
        });
    }
});

app.listen(port, () => console.log("Express App has started and server is listening!"));