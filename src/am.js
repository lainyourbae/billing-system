const express = require("express");
const { api_key, verify_token, authorize } = require("../auth")
const dbPromise = require("../db");
const app = express();

app.get('/api/data/am', api_key, verify_token, authorize(['admin']), async (req, res) => {
    let {am_id, company} = req.query;
    
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    let total, total_pages;

    let query_tambahan = "";
    
    if ( am_id !== undefined && company !== undefined) {
        query_tambahan = `WHERE am_company.am_id = ? AND company.id = ?`; 
    }else if ( am_id !== undefined ) {
        query_tambahan = `WHERE am_company.am_id = ?`;
    } else if ( company !== undefined ) {
        query_tambahan = `WHERE company.id = ?`;
    }

    const query_order = `
        GROUP BY am.nama
        ORDER BY total_invoice DESC
        LIMIT ? OFFSET ?
    `;

    try {
        const params = [am_id, company, limit, offset].filter(param => param !== undefined && param !== null);
        const query_1 = `
            SELECT
                am.nama,
                COUNT(DISTINCT company.id) AS total_company,
                SUM(invoices.receive) AS total_invoice,
                SUM(CASE WHEN invoices.paid_unpaid = 'PAID' THEN invoices.receive ELSE 0 END) AS total_paid,
                SUM(CASE WHEN invoices.paid_unpaid = 'KURANG BAYAR' THEN invoices.total_payment ELSE 0 END) AS total_paid_tambahan,
                SUM(CASE WHEN invoices.paid_unpaid = 'UNPAID' THEN invoices.receive ELSE 0 END) AS total_unpaid,
                SUM(CASE WHEN invoices.paid_unpaid = 'KURANG BAYAR' THEN invoices.total_kurang_bayar ELSE 0 END) AS total_kb
            FROM
                am
            JOIN am_company ON am.id = am_company.am_id
            JOIN company ON am_company.company_id = company.id
            JOIN services_company ON company.id = services_company.id_company
            JOIN services_period ON services_company.id = services_period.id_services_company
            JOIN invoices_services ON services_period.id = invoices_services.id_services_period
            JOIN invoices ON invoices_services.id_invoices = invoices.id
        `;
        
        const fullQuery_1 = `${query_1} ${query_tambahan} ${query_order}`;

        const [result_1] = await dbPromise.query(fullQuery_1, params.length ? params : undefined);
        total = result_1.length;
        total_pages = Math.ceil(total / limit);

        const data = result_1.map(row => {
            return {
                nama: row.nama,
                total_company: parseInt(row.total_company),
                total_invoice: parseInt(row.total_invoice),
                total_paid: parseInt(row.total_paid) + parseInt(row.total_paid_tambahan), // Menambahkan total_paid_tambahan ke total_paid
                total_unpaid: parseInt(row.total_unpaid),
                total_kb: parseInt(row.total_kb),
                total_komisi : Math.round(parseInt(row.total_invoice) * 0.025)
            };
        });

        return res.status(200).json({
            page: page,
            totalPages: total_pages,
            count: total,
            data: data
        });

    } catch (err) {
        console.error("Error:", err);
        return res.status(500).json({ message: "Invalid Server Error." });
    }
});

app.get('/api/data/am/detail', api_key, verify_token, authorize(['admin']), async (req, res) => {
    let {am_id, company, date_start, date_end} = req.query;
    
    if(!date_start || !date_end){
        return res.status(400).json({ message: "Masukan Tanggal." });
    }

    date_start = date_start.substring(0, 7);
    date_end = date_end.substring(0, 7);
    
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    let total, total_pages;

    let query_tambahan = "";
    if (am_id !== undefined && company !== undefined && date_start !== undefined && date_end !== undefined){
        query_tambahan = `WHERE am_company.am_id = ? AND company.id = ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?`;
    } else if (am_id !== undefined && date_start !== undefined && date_end !== undefined) {
        query_tambahan = `WHERE am_company.am_id = ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?`;
    } else if (company !== undefined && date_start !== undefined && date_end !== undefined){
            query_tambahan = `WHERE company.id = ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?`; 
    } else if ( date_start !== undefined && date_end !== undefined ) {
        query_tambahan = `WHERE DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?`;
    }

    const query_order = `
        GROUP BY am.nama, company.nama
        ORDER BY total_invoice DESC
    `;

    try {
        const params = [am_id, company, date_start, date_end, limit, offset].filter(param => param !== undefined && param !== null);
        const query_1 = `
            SELECT
                am.nama AS am_name,
                company.nama AS company_name,
                SUM(invoices.receive) AS total_invoice,
                SUM(CASE WHEN invoices.paid_unpaid = 'PAID' THEN invoices.receive ELSE 0 END) + 
                SUM(CASE WHEN invoices.paid_unpaid = 'KURANG BAYAR' THEN invoices.total_payment ELSE 0 END) AS total_paid,
                SUM(CASE WHEN invoices.paid_unpaid = 'UNPAID' THEN invoices.receive ELSE 0 END) AS total_unpaid,
                SUM(CASE WHEN invoices.paid_unpaid = 'KURANG BAYAR' THEN invoices.total_kurang_bayar ELSE 0 END) AS total_kb
            FROM am
            JOIN am_company ON am.id = am_company.am_id
            JOIN company ON am_company.company_id = company.id
            JOIN services_company ON company.id = services_company.id_company
            JOIN services_period ON services_company.id = services_period.id_services_company
            JOIN invoices_services ON services_period.id = invoices_services.id_services_period
            JOIN invoices ON invoices_services.id_invoices = invoices.id
        `;
        
        const fullQuery_1 = `${query_1} ${query_tambahan} ${query_order}`;

        const [result_1] = await dbPromise.query(fullQuery_1, params.length ? params : undefined);
        total = result_1.length;
        total_pages = Math.ceil(total / limit);

        const data = result_1.map(row => {
            return {
                nama_am: row.am_name,
                nama_company: row.company_name,
                total_invoice: parseInt(row.total_invoice),
                total_paid: parseInt(row.total_paid),
                total_unpaid: parseInt(row.total_unpaid),
                total_kb: parseInt(row.total_kb),
                total_komisi : Math.round(parseInt(row.total_invoice) * 0.025)
            };
        });

        return res.status(200).json({
            page: page,
            totalPages: total_pages,
            count: total,
            data: data
        });

    } catch (err) {
        console.error("Error:", err);
        return res.status(500).json({ message: "Invalid Server Error." });
    }
});

module.exports = app;