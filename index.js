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

// Original routes
app.get("/", (req, res) => res.render("index"));
app.get("/login", (req, res) => res.render("login"));

// New routes for additional pages
app.get("/about", (req, res) => res.render("about"));
app.get("/createaccount", (req, res) => res.render("createaccount"));
app.get("/distribution", (req, res) => res.render("distribution"));
app.get("/donationform", (req, res) => res.render("donationform"));
app.get("/eventrequest", (req, res) => res.render("eventrequest"));
app.get("/volunteer", (req, res) => res.render("volunteer"));
app.get("/impact", (req, res) => res.render("impact"));
app.get("/involved", (req, res) => res.render("involved"));
app.get("/jen", (req, res) => res.render("jen"));
app.get("/thank-you", (req, res) => res.render("index"));



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

        res.redirect('/admin');
    } catch (error) {
        console.error('Error saving vest distribution data:', error);
        res.status(500).send('Error saving vest distribution data.');
    }
});




app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
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
        if (error.code === '23505') {
            const conflictField = error.detail.includes('account_email') ? 'Email' : 'Username';
            res.status(400).send(`${conflictField} is already in use. Please choose a different one.`);
        } else {
            res.status(500).send('Error creating account.');
        }
    }
});

app.get('/admin', async (req, res) => {
    try {
        // Fetch accounts data
        const accounts = await knex('accounts').select('*');
        
        // Fetch initial set of volunteers (e.g., first 30 for pagination)
        const volunteers = await knex('volunteers').select('*').limit(30);

        // Render the admin view with both accounts and volunteers
        res.render('admin', { accounts, volunteers });
    } catch (error) {
        console.error('Error fetching admin data:', error);
        res.status(500).send('An error occurred while loading the admin page.');
    }
});


app.post('/editAccount', async (req, res) => {
    const {
      account_id,
      account_first_name,
      account_last_name,
      account_username,
      account_email,
      role_id
    } = req.body;
  
    try {
      // Validate that email and username are unique (if they are changed)
      const existingAccount = await knex('accounts')
        .select('account_id')
        .where((qb) => {
          qb.where('account_email', account_email)
            .orWhere('account_username', account_username);
        })
        .andWhere('account_id', '!=', account_id);
  
      if (existingAccount.length > 0) {
        return res.status(400).send('Email or username already exists for another account.');
      }
  
      // Update the account in the database
      await knex('accounts')
        .where('account_id', account_id)
        .update({
          account_first_name,
          account_last_name,
          account_username,
          account_email: account_email.toLowerCase(),
          role_id: parseInt(role_id), // Ensure role_id is an integer
        });
  
      res.redirect('/admin'); // Redirect back to the admin portal or appropriate page
    } catch (error) {
      console.error('Error updating account:', error);
      res.status(500).send('An error occurred while updating the account.');
    }
  });
  


  app.post('/deleteAccount', async (req, res) => {
    const { account_id } = req.body;

    try {
        // Delete the account by ID
        await knex('accounts')
            .where({ account_id })
            .del();

        console.log(`Account with ID ${account_id} deleted successfully.`);
        res.redirect('/admin'); // Redirect back to admin page
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).send('An error occurred while deleting the account.');
    }
});


// Fetch Admins with Pagination
app.get('/admins', async (req, res) => {
    const { page = 1, search = "" } = req.query;
    const limit = 30; // Number of admins per page
    const offset = (page - 1) * limit;

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


// Fetch New Events with Status "Requested"
app.get('/events/new', async (req, res) => {
    try {
        const newEvents = await knex('events')
            .join('event_contacts', 'events.contact_id', 'event_contacts.contact_id')
            .select(
                'events.event_id',
                'events.event_type',
                'events.event_location',
                'events.event_street',
                'events.event_city',
                'events.event_state',
                'events.event_zip_code',
                'events.event_date',
                'events.event_start_time',
                'events.event_end_time',
                'events.event_total_hours',
                'events.event_status',
                'events.jens_story',
                'events.contribution',
                'events.notes',
                'event_contacts.contact_first_name',
                'event_contacts.contact_last_name',
                'event_contacts.contact_email',
                'event_contacts.contact_phone_number',
                'event_contacts.contact_preferred_communication'
            )
            .where('events.event_status', 'Requested')
            .orderBy('events.event_date', 'asc');

        res.json(newEvents);
    } catch (error) {
        console.error('Error fetching new events:', error);
        res.status(500).send('Error fetching new events');
    }
});

// Update Event Details and Status
app.post('/events/update/:id', async (req, res) => {
    const { id } = req.params;
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
        contribution,
        notes,
        event_status,
    } = req.body;

    try {
        await knex('events')
            .where('event_id', id)
            .update({
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
                contribution,
                notes,
                event_status,
            });

        res.status(200).send('Event updated successfully');
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).send('Error updating event');
    }
});

// Delete Event
app.delete('/events/delete/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await knex('events')
            .where('event_id', id)
            .del();

        res.status(200).send('Event deleted successfully');
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).send('Error deleting event');
    }
});

// Fetch All Events for Management
app.get('/events/all', async (req, res) => {
    const { page = 1, search = '' } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    try {
        const allEvents = await knex('events')
            .join('event_contacts', 'events.contact_id', 'event_contacts.contact_id')
            .select(
                'events.event_id',
                'events.event_type',
                'events.event_location',
                'events.event_street',
                'events.event_city',
                'events.event_state',
                'events.event_zip_code',
                'events.event_date',
                'events.event_start_time',
                'events.event_end_time',
                'events.event_total_hours',
                'events.event_status',
                'events.jens_story',
                'events.contribution',
                'events.notes',
                'event_contacts.contact_first_name',
                'event_contacts.contact_last_name',
                'event_contacts.contact_email',
                'event_contacts.contact_phone_number',
                'event_contacts.contact_preferred_communication'
            )
            .where((builder) => {
                if (search) {
                    builder
                        .where('events.event_type', 'ilike', `%${search}%`)
                        .orWhere('events.event_location', 'ilike', `%${search}%`)
                        .orWhere('event_contacts.contact_first_name', 'ilike', `%${search}%`)
                        .orWhere('event_contacts.contact_last_name', 'ilike', `%${search}%`);
                }
            })
            .orderBy('events.event_date', 'desc')
            .limit(limit)
            .offset(offset);

        res.json(allEvents);
    } catch (error) {
        console.error('Error fetching all events:', error);
        res.status(500).send('Error fetching all events');
    }
});

app.get('/events/history', async (req, res) => {
    const { page = 1, search = '' } = req.query;
    const limit = 30;
    const offset = (page - 1) * limit;

    try {
        // Query events excluding "Requested"
        const query = knex('events')
            .select('*')
            .where('event_status', '!=', 'Requested')
            .andWhere((builder) => {
                if (search) {
                    builder
                        .where('event_type', 'ilike', `%${search}%`)
                        .orWhere('event_location', 'ilike', `%${search}%`)
                        .orWhere('notes', 'ilike', `%${search}%`);
                }
            })
            .orderBy('event_date', 'desc') // Sort by date
            .limit(limit)
            .offset(offset);

        const events = await query;

        res.json(events);
    } catch (error) {
        console.error('Error fetching event history:', error);
        res.status(500).send('Error fetching event history.');
    }
});






// Updated Server-Side Logic for Distributions and Recipients

// Fetch all distributions with their recipients
// Fetch distributions with recipients
// Fetch distributions with recipients
app.get('/distributions', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    try {
        // Fetch distributions
        const distributions = await knex('vest_inventory')
            .join('distribution_location', 'vest_inventory.location_id', '=', 'distribution_location.location_id')
            .select(
                'vest_inventory.inventory_id',
                'distribution_location.distribution_neighborhood',
                'distribution_location.distribution_city',
                'distribution_location.distribution_state',
                'vest_inventory.distribution_date',
                'vest_inventory.vests_brought',
                'vest_inventory.vests_left'
            )
            .limit(limit)
            .offset(offset);

        // Fetch all recipients for the fetched distributions
        const distributionIds = distributions.map(dist => dist.inventory_id);
        const recipients = await knex('recipients')
            .whereIn('location_id', function () {
                this.select('location_id')
                    .from('vest_inventory')
                    .whereIn('inventory_id', distributionIds);
            })
            .select(
                'recipient_id',
                'recipient_first_name',
                'recipient_last_name',
                'size',
                'location_id'
            );

        // Group recipients by location_id
        const recipientsGrouped = recipients.reduce((acc, recipient) => {
            if (!acc[recipient.location_id]) acc[recipient.location_id] = [];
            acc[recipient.location_id].push(recipient);
            return acc;
        }, {});

        res.json({ distributions, recipientsGrouped });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching distributions and recipients' });
    }
});


// Edit Distribution
app.put('/distributions/:distributionId', async (req, res) => {
    const { distributionId } = req.params;
    const { distribution_neighborhood, distribution_city, distribution_state, vests_brought, vests_left } = req.body;

    if (!distribution_neighborhood || !distribution_city || !distribution_state || vests_brought == null || vests_left == null) {
        return res.status(400).json({ error: 'Missing required fields for distribution update' });
    }

    try {
        // Transaction to ensure atomicity
        await knex.transaction(async (trx) => {
            // Update distribution location
            await trx('distribution_location')
                .where('location_id', function () {
                    this.select('location_id').from('vest_inventory').where('inventory_id', distributionId);
                })
                .update({
                    distribution_neighborhood,
                    distribution_city,
                    distribution_state
                });

            // Update vest inventory
            await trx('vest_inventory')
                .where('inventory_id', distributionId)
                .update({
                    vests_brought,
                    vests_left
                });
        });

        res.json({ message: 'Distribution updated successfully' });
    } catch (err) {
        console.error('Error updating distribution:', err.stack);
        res.status(500).json({ error: 'Error updating distribution' });
    }
});

// Edit Recipient
app.put('/recipients/:recipientId', async (req, res) => {
    const { recipientId } = req.params;
    const { recipient_first_name, recipient_last_name, size } = req.body;

    try {
        await knex('recipients')
            .where('recipient_id', recipientId)
            .update({
                recipient_first_name,
                recipient_last_name,
                size
            });

        res.json({ message: 'Recipient updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating recipient' });
    }
});

// Delete Distribution
app.delete('/distributions/:distributionId', async (req, res) => {
    const { distributionId } = req.params;

    try {
        // Transaction to ensure atomicity
        await knex.transaction(async (trx) => {
            // Delete associated recipients first
            await trx('recipients')
                .where('location_id', function () {
                    this.select('location_id').from('vest_inventory').where('inventory_id', distributionId);
                })
                .del();

            // Delete the distribution itself
            const deletedRows = await trx('vest_inventory')
                .where('inventory_id', distributionId)
                .del();

            if (deletedRows === 0) {
                throw new Error('No distribution found with the provided ID');
            }
        });

        res.json({ message: 'Distribution and associated recipients deleted successfully' });
    } catch (err) {
        console.error('Error deleting distribution:', err.stack);
        res.status(500).json({ error: err.message || 'Error deleting distribution' });
    }
});

// Delete Recipient
app.delete('/recipients/:recipientId', async (req, res) => {
    const { recipientId } = req.params;

    try {
        await knex('recipients')
            .where('recipient_id', recipientId)
            .del();

        res.json({ message: 'Recipient deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error deleting recipient' });
    }
});

// PROTECTED ROUTES
app.get("/about", (req, res) => res.render("about", { user: req.session.user }));
app.get("/distribution", isAuthenticated, (req, res) => res.render("distribution"));
app.get("/donationform", (req, res) => res.render("donationform"));
app.get("/eventrequest", (req, res) => res.render("eventrequest"));
app.get("/volunteer", (req, res) => res.render("volunteer"));
app.get("/donation", (req, res) => res.render("donation"));
app.get("/impact", (req, res) => res.render("impact"));
app.get("/involved", (req, res) => res.render("involved"));
app.get("/jen", (req, res) => res.render("jen"));

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


// Session timeout checker
const sessionTimeoutChecker = setInterval(() => {
    console.log('Checking for expired sessions...');
}, 5 * 60 * 1000);

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
            case 2:
                res.redirect('/admin');
                break;
            default:
                res.redirect('/regular');
        }
    }
});

app.listen(port, () => console.log("Express App has started and server is listening!"));