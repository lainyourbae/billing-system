const express = require("express");
const { api_key, verify_token, authorize } = require("../auth")
const dbPromise = require("../db");
const app = express();

app.get('/api/filter/company', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
    const { company, services, term, status, brand } = req.query;
    let query = `
        SELECT DISTINCT 
            company.id AS company_id,
            company.nama AS company_name, 
            services.nama AS service_name,
            company.brand AS brand,
            services_period.term,
            invoices.paid_unpaid AS status
        FROM company
        JOIN services_company ON services_company.id_company = company.id
        JOIN services ON services.id = services_company.id_services
        JOIN services_period ON services_period.id_services_company = services_company.id
        JOIN invoices_services ON invoices_services.id_services_period = services_period.id
        JOIN invoices ON invoices.id = invoices_services.id_invoices
        JOIN am_company ON am_company.company_id = company.id
        JOIN am ON am.id = am_company.am_id
        WHERE 1=1
    `;
    let params = [];

    if (company) {
        query += ' AND company.id = ?';
        params.push(company);
    }

    if (services) {
        query += ' AND services.nama LIKE ?';
        params.push(`%${services}%`);
    }

    if(brand !== undefined){
        query +=  ` AND company.brand = ?`;
        params.push(brand);
    }

    if(term !== undefined){
        query += ` AND services_period.term = ?`;
        params.push(term) 
    }

    if(status !== undefined){
        query += ` AND invoices.paid_unpaid = ?`;
        params.push(status);  
    }


    const [rows] = await dbPromise.query(query, params);

    const result = {
        company: [
            ...new Map(
                rows.map(row => [row.company_id, { company_id: row.company_id, company_name: row.company_name }])
            ).values()
        ],
        services: [ 
            ...new Map(
                rows.map(row => [row.service_name, { services: row.service_name }])
            ).values()
        ],
        brand: [
            ...new Map(
                rows.map(row => [row.brand, {brand: row.brand}])
            ).values()
        ],
        status: [...new Map(
            rows.map(row => [row.status, {status: row.status}])
            ).values()
        ],
        terms: [...new Map(
            rows.map(row => [row.term, {term: row.term}])
            ).values()
        ]
    };
    

    res.json(result);
});

app.get('/api/filter/am', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
    const { company, am_id, status } = req.query;
    let query = `
        SELECT DISTINCT 
            company.id AS company_id,
            company.nama AS company_name, 
            am.id AS am_id,
            am.nama AS am_name,
            invoices.paid_unpaid AS status
        FROM company
        JOIN services_company ON services_company.id_company = company.id
        JOIN services ON services.id = services_company.id_services
        JOIN services_period ON services_period.id_services_company = services_company.id
        JOIN invoices_services ON invoices_services.id_services_period = services_period.id
        JOIN invoices ON invoices.id = invoices_services.id_invoices
        JOIN am_company ON am_company.company_id = company.id
        JOIN am ON am.id = am_company.am_id
        WHERE 1=1
    `;
    let params = [];

    if (company) {
        query += ' AND company.id = ?';
        params.push(company);
    }

    if (am_id) {
        query += ' AND am.id = ?';
        params.push(am_id);
    }

    if(status !== undefined){
        query += ` AND invoices.paid_unpaid = ?`;
        params.push(status);  
    }

    const [rows] = await dbPromise.query(query, params);

    const result = {
        company: [
            ...new Map(
                rows.map(row => [row.company_id, { company_id: row.company_id, company_name: row.company_name }])
            ).values()
        ],
        am: [
            ...new Map(
                rows.map(row => [row.am_id, { am_id: row.am_id, am_name: row.am_name }])
            ).values()
        ],
        status: [...new Map(
            rows.map(row => [row.status, {status: row.status}])
            ).values()
        ]
    };
    

    res.json(result);
});

// app.get('/api/filter/company', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
//     const user_id = req.user.id;
//     const user_role = req.user.role;
//     try{
//         if(user_role === 'admin') {
//             const query = "SELECT id, nama FROM company";
//             const [result] = await dbPromise.query(query);
//             return res.status(200).json(result);   
//         }
//         if(user_role === 'AM') {
//             const query_am = "SELECT id FROM am WHERE user_id = ?";
//             const [result_am] = await dbPromise.query(query_am, user_id);
//             const am_id = result_am[0].id;

//             const query = `
//                 SELECT nama 
//                 FROM company
//                 JOIN am_company ON am_company.company_id = company.id
//                 WHERE am_company.am_id = ?
//             `;
//             const [result] = await dbPromise.query(query, am_id);
//             return res.status(200).json(result);   
//         }
//     } catch (err) {
//         console.error("Error:", err);
//         return res.status(401).json({ message: "Invalid Server Error." });
//     }
// });

// app.get('/api/filter/services', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
//     const user_id = req.user.id;
//     const user_role = req.user.role;
//     try{
//         if(user_role === 'admin') {
//             const query = "SELECT nama FROM services";
//             const [result] = await dbPromise.query(query);
//             result.unshift({nama: "LEASED CORE"});
//             result.unshift({nama: "LEASED LINED"});
//             result.unshift({nama: "DARK FIBER"});
//             result.unshift({nama: "COLOCATION"});
//             return res.status(200).json(result);   
//         }
//         if(user_role === 'AM') {
//             const query_am = "SELECT id FROM am WHERE user_id = ?";
//             const [result_am] = await dbPromise.query(query_am, user_id);
//             const am_id = result_am[0].id;

//             const query = `
//                 SELECT nama 
//                 FROM services
//                 JOIN services_company ON services.id = services_company.id_services
//                 JOIN services_period ON services_company.id = services_period.id_services_company
//                 JOIN am_company ON am_company.company_id = services_company.id_company
//                 WHERE am_company.am_id = ?
//             `;
//             const [result] = await dbPromise.query(query, am_id);
            
//             return res.status(200).json(result);   
//         }
//     } catch (err) {
//         console.error("Error:", err);
//         return res.status(401).json({ message: "Invalid Server Error." });
//     }
// });

// app.get('/api/filter/brand', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
//     const user_id = req.user.id;
//     const user_role = req.user.role;
//     try{
//         if(user_role === 'admin') {
//             const query = "SELECT id, brand FROM company";
//             const [result] = await dbPromise.query(query);
//             return res.status(200).json(result);   
//         }
//         if(user_role === 'AM') {
//             const query_am = "SELECT id FROM am WHERE user_id = ?";
//             const [result_am] = await dbPromise.query(query_am, user_id);
//             const am_id = result_am[0].id;

//             const query = `
//                 SELECT brand 
//                 FROM company
//                 JOIN am_company ON am_company.company_id = company.id
//                 WHERE am_company.am_id = ?
//             `;
//             const [result] = await dbPromise.query(query, am_id);
//             return res.status(200).json(result);   
//         }
//     } catch (err) {
//         console.error("Error:", err);
//         return res.status(401).json({ message: "Invalid Server Error." });
//     }
// });

// app.get('/api/filter/term', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
//     const user_id = req.user.id;
//     const user_role = req.user.role;
//     try{
//         if(user_role === 'admin') {
//             const query = "SELECT DISTINCT(term) FROM services_period";
//             const [result] = await dbPromise.query(query);
//             return res.status(200).json(result);   
//         }
//         if(user_role === 'AM') {
//             const query_am = "SELECT id FROM am WHERE user_id = ?";
//             const [result_am] = await dbPromise.query(query_am, user_id);
//             const am_id = result_am[0].id;

//             const query = `
//                 SELECT DISTINCT(term) 
//                 FROM services_period
//                 JOIN services_company ON services_period.id_services_company = services_company.id
//                 JOIN services ON services_company.id_services = services.id
//                 JOIN am_company ON am_company.company_id = services_company.id_company
//                 WHERE am_company.am_id = ?
//             `;
//             const [result] = await dbPromise.query(query, am_id);
//             return res.status(200).json(result);   
//         }
//     } catch (err) {
//         console.error("Error:", err);
//         return res.status(401).json({ message: "Invalid Server Error." });
//     }
// });

// app.get('/api/filter/inv-date', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
//     const user_id = req.user.id;
//     const user_role = req.user.role;
//     try{
//         if(user_role === 'admin') {
//             const query = "SELECT DISTINCT(inv_date) FROM invoices";
//             const [result] = await dbPromise.query(query);
//             return res.status(200).json(result);   
//         }
//         if(user_role === 'AM') {
//             const query_am = "SELECT id FROM am WHERE user_id = ?";
//             const [result_am] = await dbPromise.query(query_am, user_id);
//             const am_id = result_am[0].id;

//             const query = `
//                 SELECT DISTINCT(inv_date) 
//                 FROM invoices
//                 JOIN invoices_services ON invoices.id = invoices_services.id_invoices
//                 JOIN services_period ON invoices_services.id_services_period = services_period.id
//                 JOIN services_company ON services_period.id_services_company = services_company.id
//                 JOIN am_company ON am_company.company_id = services_company.id_company
//                 WHERE am_company.am_id = ?
//             `;
//             const [result] = await dbPromise.query(query, am_id);
//             return res.status(200).json(result);   
//         }
//     } catch (err) {
//         console.error("Error:", err);
//         return res.status(401).json({ message: "Invalid Server Error." });
//     }
// });

// app.get('/api/filter/status', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
//     const user_id = req.user.id;
//     const user_role = req.user.role;
//     try{
//         if(user_role === 'admin') {
//             const query = "SELECT DISTINCT(paid_unpaid) FROM invoices";
//             const [result] = await dbPromise.query(query);
//             return res.status(200).json(result);   
//         }
//         if(user_role === 'AM') {
//             const query_am = "SELECT id FROM am WHERE user_id = ?";
//             const [result_am] = await dbPromise.query(query_am, user_id);
//             const am_id = result_am[0].id;

//             const query = `
//                 SELECT DISTINCT(paid_unpaid) 
//                 FROM invoices
//                 JOIN invoices_services ON invoices.id = invoices_services.id_invoices
//                 JOIN services_period ON invoices_services.id_services_period = services_period.id
//                 JOIN services_company ON services_period.id_services_company = services_company.id
//                 JOIN am_company ON am_company.company_id = services_company.id_company
//                 WHERE am_company.am_id = ?
//             `;
//             const [result] = await dbPromise.query(query, am_id);
//             return res.status(200).json(result);   
//         }
//     } catch (err) {
//         console.error("Error:", err);
//         return res.status(401).json({ message: "Invalid Server Error." });
//     }
// });

// app.get('/api/filter/payment-date', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
//     const user_id = req.user.id;
//     const user_role = req.user.role;
//     try{
//         if(user_role === 'admin') {
//             const query = "SELECT DISTINCT(payment_date) FROM invoices";
//             const [result] = await dbPromise.query(query);
//             return res.status(200).json(result);   
//         }
//         if(user_role === 'AM') {
//             const query_am = "SELECT id FROM am WHERE user_id = ?";
//             const [result_am] = await dbPromise.query(query_am, user_id);
//             const am_id = result_am[0].id;

//             const query = `
//                 SELECT DISTINCT(payment_date) 
//                 FROM invoices
//                 JOIN invoices_services ON invoices.id = invoices_services.id_invoices
//                 JOIN services_period ON invoices_services.id_services_period = services_period.id
//                 JOIN services_company ON services_period.id_services_company = services_company.id
//                 JOIN am_company ON am_company.company_id = services_company.id_company
//                 WHERE am_company.user_id = ?
//             `;
//             const [result] = await dbPromise.query(query, am_id);
//             return res.status(200).json(result);   
//         }
//     } catch (err) {
//         console.error("Error:", err);
//         return res.status(401).json({ message: "Invalid Server Error." });
//     }
// });

// app.get('/api/filter/am', api_key, verify_token, authorize(['admin']), async (req, res) => {
//     const user_id = req.user.id;
//     const user_role = req.user.role;
//     try {
//         const query = "SELECT id, nama FROM am";
//         const [result] = await dbPromise.query(query);
//         return res.status(200).json(result);   
//     } catch (err) {
//         console.error("Error:", err);
//         return res.status(500).json({ message: "Invalid Server Error." });
//     }
// })

module.exports = app;