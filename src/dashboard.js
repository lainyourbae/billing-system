const express = require("express");
const { api_key, verify_token, authorize } = require("../auth")
const dbPromise = require("../db");
const app = express();

const getYearlyData = async (user_id, paidUnpaid, company, services, date_start, date_end, query_tambahan) => {
    const query = `
        SELECT 
            MONTH(inv_date) AS month, 
            COUNT(*) AS total,  
            SUM(CASE WHEN paid_unpaid = 'PAID' THEN receive ELSE 0 END) AS total_inv_paid
        FROM invoices
    `;
    const fullQuery = `${query} ${query_tambahan}`;

    const params = [user_id, paidUnpaid, company, services, date_start, date_end].filter(param => param !== undefined && param !== null);
    const [result] = await dbPromise.query(fullQuery, params.length ? params : undefined);

    const monthsData = {
        january: { total_company: 0, total_inv: 0 },
        february: { total_company: 0, total_inv: 0 },
        march: { total_company: 0, total_inv: 0 },
        april: { total_company: 0, total_inv: 0 },
        may: { total_company: 0, total_inv: 0 },
        june: { total_company: 0, total_inv: 0 },
        july: { total_company: 0, total_inv: 0 },
        august: { total_company: 0, total_inv: 0 },
        september: { total_company: 0, total_inv: 0 },
        october: { total_company: 0, total_inv: 0 },
        november: { total_company: 0, total_inv: 0 },
        december: { total_company: 0, total_inv: 0 }
    };
    
    result.forEach(row => {
        const monthMap = {
            1: 'january',
            2: 'february',
            3: 'march',
            4: 'april',
            5: 'may',
            6: 'june',
            7: 'july',
            8: 'august',
            9: 'september',
            10: 'october',
            11: 'november',
            12: 'december'
        };
        
        const monthName = monthMap[row.month];
    
        monthsData[monthName] = {
            total_company: row.total || 0,
            total_inv: row.total_inv_paid || 0
        };
    });

    const monthsArray = [
        [monthsData.january],
        [monthsData.february],
        [monthsData.march],
        [monthsData.april],
        [monthsData.may],
        [monthsData.june],
        [monthsData.july],
        [monthsData.august],
        [monthsData.september],
        [monthsData.october],
        [monthsData.november],
        [monthsData.december]
    ];
    
    return monthsArray;
};

const getTotalData = async (user_id, company, services, date_start, date_end, query_tambahan) => {
    const query = `
        SELECT
            COUNT(DISTINCT company.id) AS total_company,
            SUM(invoices.receive) AS total_invoice, 
            COUNT(DISTINCT services.id) AS total_services,
            SUM(CASE WHEN paid_unpaid = 'PAID' THEN 1 ELSE 0 END) AS total_paid,
            SUM(CASE WHEN paid_unpaid = 'UNPAID' THEN 1 ELSE 0 END) AS total_unpaid,
            SUM(CASE WHEN paid_unpaid = 'KURANG BAYAR' THEN 1 ELSE 0 END) AS total_kb,
            SUM(CASE WHEN paid_unpaid = 'PAID' THEN receive ELSE 0 END) AS total_inv_paid,
            SUM(CASE WHEN paid_unpaid = 'KURANG BAYAR' THEN total_payment ELSE 0 END) AS total_inv_paid_tambahan,
            SUM(CASE WHEN paid_unpaid = 'UNPAID' THEN receive ELSE 0 END) AS total_inv_unpaid,
            SUM(CASE WHEN paid_unpaid = 'KURANG BAYAR' THEN total_kurang_bayar ELSE 0 END) AS total_inv_kb
    `;
    
    const fullQuery = `${query} ${query_tambahan}`;
    const params = [user_id, company, services, date_start, date_end].filter(param => param !== undefined && param !== null); 

    const [result_1] = await dbPromise.query(fullQuery, params.length ? params : undefined);
    
    let {
        total_company = 0,
        total_invoice = 0,
        total_services = 0,
        total_paid = 0,
        total_unpaid = 0,
        total_kb = 0,
        total_inv_paid = 0,
        total_inv_unpaid = 0,
        total_inv_kb = 0,
        total_inv_paid_tambahan = 0
    } = result_1[0] || {};
    
    total_company = total_company ?? 0;
    total_invoice = total_invoice ?? 0;
    total_services = total_services ?? 0;
    total_paid = total_paid ?? 0;
    total_unpaid = total_unpaid ?? 0;
    total_kb = total_kb ?? 0;
    total_inv_paid = total_inv_paid ?? 0;
    total_inv_unpaid = total_inv_unpaid ?? 0;
    total_inv_kb = total_inv_kb ?? 0;
    total_inv_paid_tambahan = total_inv_paid_tambahan ?? 0;

    total_inv_paid = parseInt(total_inv_paid) + parseInt(total_inv_paid_tambahan);

    return {
        total_company: [{total: total_company, total_services: total_services}],
        total_invoices: [{total_inv: parseInt(total_invoice), total_company: total_kb}],
        paid: [{ total_inv: parseInt(total_inv_paid), total_company: total_paid }],
        unpaid: [{ total_inv: parseInt(total_inv_unpaid), total_company: total_unpaid  }],
        kb: [{ total_inv: parseInt(total_inv_kb), total_company: total_kb,  }]
    };
};

const executeQueryByStatus = async (am_id, company, status, date_start, date_end, limit, offset) => {
    let totalField;
    let statusCondition;
    switch (status) {
        case 'PAID':
            totalField = `SUM(CASE WHEN invoices.paid_unpaid = 'PAID' THEN invoices.receive ELSE 0 END) + 
                        SUM(CASE WHEN invoices.paid_unpaid = 'KURANG BAYAR' THEN invoices.total_payment ELSE 0 END)`;
            statusCondition = "invoices.paid_unpaid IN ('PAID', 'KURANG BAYAR')";
            break;
        case 'UNPAID':
            totalField = `SUM(CASE WHEN invoices.paid_unpaid = 'UNPAID' THEN invoices.receive ELSE 0 END)`;
            statusCondition = "invoices.paid_unpaid = 'UNPAID'";
            break;
        case 'KURANG BAYAR':
            totalField = `SUM(CASE WHEN invoices.paid_unpaid = 'KURANG BAYAR' THEN invoices.total_payment ELSE 0 END)`;
            statusCondition = "invoices.paid_unpaid = 'KURANG BAYAR'";
            break;
        default:
            throw new Error("Status tidak valid");
    }

    let additionalConditions = '';
    let additionalParams = [];

    if (company) {
        additionalConditions += " AND company.id = ?";
        additionalParams.push(company);
    }
    if (am_id) {
        additionalConditions += " AND am.id = ?";
        additionalParams.push(am_id);
    }

    
    const queryTotalCount = `
        SELECT COUNT(*) AS total_count
        FROM (
            SELECT
                company.nama AS company_name,
                am.nama AS am_name,
                ${totalField} AS total
            FROM
                company
            JOIN services_company ON company.id = services_company.id_company
            JOIN services_period ON services_company.id = services_period.id_services_company
            JOIN invoices_services ON services_period.id = invoices_services.id_services_period
            JOIN invoices ON invoices_services.id_invoices = invoices.id
            JOIN am_company ON services_company.id_company = am_company.company_id
            JOIN am ON am_company.am_id = am.id
            WHERE
                ${statusCondition} AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?${additionalConditions}
            GROUP BY
                company.nama, am.nama
            HAVING
                total > 0
        ) AS subquery
    `;
    const [resultTotal] = await dbPromise.query(queryTotalCount, [ date_start, date_end, ...additionalParams]);
    const total = resultTotal[0]?.total_count || 0;
    const total_pages = Math.ceil(total / limit);

    const queryResults = `
        SELECT
            company.nama AS company_name,
            am.nama AS am_name,
            ${totalField} AS total
        FROM
            company
        JOIN services_company ON company.id = services_company.id_company
        JOIN services_period ON services_company.id = services_period.id_services_company
        JOIN invoices_services ON services_period.id = invoices_services.id_services_period
        JOIN invoices ON invoices_services.id_invoices = invoices.id
        JOIN am_company ON services_company.id_company = am_company.company_id
        JOIN am ON am_company.am_id = am.id
        WHERE
            ${statusCondition} AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?${additionalConditions}
        GROUP BY
            company.nama, am.nama
        HAVING
            total > 0
        ORDER BY
            total DESC
        LIMIT ? OFFSET ?
    `;
    const [result] = await dbPromise.query(queryResults, [date_start, date_end, ...additionalParams, limit, offset]);
    result.forEach(row => {
        row.status = status;
    });

    return ({
        page: Math.ceil(offset / limit) + 1,
        totalPages: total_pages,
        count: total,
        data: result
    });       
};

app.get('/api/status', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
    let {date_start, date_end, status, company, services, am_id} = req.query;
    if(!date_start || !date_end){
        return res.status(400).json({ message: "Masukan Tanggal." });
    }

    date_start = date_start.substring(0, 7);
    date_end = date_end.substring(0, 7);

    let user_id = req.user.id;
    const user_role = req.user.role;

    try{
        if(user_role === 'admin'){
            user_id = undefined;
            if(company !== undefined){
                const query = `         
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN company ON services_company.id_company = company.id
                    JOIN services ON services_company.id_services = services.id
                    WHERE
                        invoices.paid_unpaid = ? AND company.id = ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                    GROUP BY
                        MONTH(invoices.inv_date)
                    ORDER BY
                        MONTH(invoices.inv_date)
                `;
                const paid = await getYearlyData(user_id, 'PAID', company, services, date_start, date_end, query);
    
                return res.status(200).json({
                    paid: paid
                });    
            }
            if(services !== undefined){
                const query = `         
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN company ON services_company.id_company = company.id
                    JOIN services ON services_company.id_services = services.id
                    WHERE
                        invoices.paid_unpaid = ? AND services.nama LIKE ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                    GROUP BY
                        MONTH(invoices.inv_date)
                    ORDER BY
                        MONTH(invoices.inv_date)
                `;
                const paid = await getYearlyData(user_id, 'PAID', company, `%${services}%`, date_start, date_end, query);       
                return res.status(200).json({
                    paid: paid,
                });                        
            }
            if(am_id !== undefined){
                user_id = am_id;
                const query = `         
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN am_company ON am_company.company_id = services_company.id_company
                    JOIN am ON am.id = am_company.am_id
                    JOIN company ON services_company.id_company = company.id
                    JOIN services ON services_company.id_services = services.id
                    WHERE
                        am.id = ? AND invoices.paid_unpaid = ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                    GROUP BY
                        MONTH(invoices.inv_date)
                    ORDER BY
                        MONTH(invoices.inv_date)
                `;
                const paid = await getYearlyData(user_id, 'PAID', company, services, date_start, date_end, query);
                return res.status(200).json({
                    paid: paid,
                });    
            }
            if(company === undefined && services === undefined && am_id == undefined){
                const query = `         
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN company ON services_company.id_company = company.id
                    JOIN services ON services_company.id_services = services.id
                    WHERE
                        invoices.paid_unpaid = ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                    GROUP BY
                        MONTH(invoices.inv_date)
                    ORDER BY
                        MONTH(invoices.inv_date)
                `;
                const paid = await getYearlyData(user_id, 'PAID', company, services, date_start, date_end, query);    
                return res.status(200).json({
                    paid: paid,
                });
                                    
            }
        }
        if(user_role === 'AM'){
            const query_id = "SELECT id FROM am WHERE user_id = ?";
            const [result_id] = await dbPromise.query(query_id, user_id);
            const am_id = result_id[0].id;

            if (services !== undefined) {
                if(status === undefined){
                    const query = `         
                        JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                        JOIN services_period ON invoices_services.id_services_period = services_period.id
                        JOIN services_company ON services_period.id_services_company = services_company.id
                        JOIN am_company ON am_company.company_id = services_company.id_company
                        JOIN am ON am_company.am_id = am.id 
                        JOIN company ON services_company.id_company = company.id
                        JOIN services ON services_company.id_services = services.id
                        WHERE
                            am_company.am_id = ? AND services.nama LIKE ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                        GROUP BY
                            MONTH(invoices.inv_date)
                        ORDER BY
                            MONTH(invoices.inv_date)
                    `;
                    const paid = await getYearlyData(user_id, 'PAID', company, `%${services}%`, date_start, date_end, query);
                    const unpaid = await getYearlyData(user_id, 'UNPAID', company, `%${services}%`, date_start, date_end, query);
                    const kb = await getYearlyData(user_id, 'KURANG BAYAR', company, `%${services}%`, date_start, date_end, query);
        
                    return res.status(200).json({
                        paid: paid,
                        unpaid: unpaid,
                        kb: kb
                    });
                }                    
                if(status !== undefined){
                    const query = `
                        JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                        JOIN services_period ON invoices_services.id_services_period = services_period.id
                        JOIN services_company ON services_period.id_services_company = services_company.id
                        JOIN am_company ON am_company.company_id = services_company.id_company
                        JOIN am ON am_company.am_id = am.id 
                        JOIN company ON services_company.id_company = company.id
                        JOIN services ON services_company.id_services = services.id
                        WHERE
                            am_company.am_id = ? AND invoices.paid_unpaid = ? AND services.nama LIKE ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                        GROUP BY
                            MONTH(invoices.inv_date)
                        ORDER BY
                            MONTH(invoices.inv_date)
                    `;
                    const data = await getYearlyData(user_id, status, company, `%${services}%`, date_start, date_end, query);
                    return res.status(200).json({
                        data: data
                    });
                }
            }
            if (company !== undefined){
                if(status === undefined){
                    const query = `         
                        JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                        JOIN services_period ON invoices_services.id_services_period = services_period.id
                        JOIN services_company ON services_period.id_services_company = services_company.id
                        JOIN am_company ON am_company.company_id = services_company.id_company
                        JOIN am ON am_company.am_id = am.id 
                        JOIN company ON services_company.id_company = company.id
                        JOIN services ON services_company.id_services = services.id
                        WHERE
                            am_company.am_id = ? AND company.id = ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                        GROUP BY
                            MONTH(invoices.inv_date)
                        ORDER BY
                            MONTH(invoices.inv_date)
                    `;
                    const paid = await getYearlyData(am_id, 'PAID', company, services, date_start, date_end, query);
                    const unpaid = await getYearlyData(am_id, 'UNPAID', company, services, date_start, date_end, query);
                    const kb = await getYearlyData(am_id, 'KURANG BAYAR', company, services, date_start, date_end, query);
        
                    return res.status(200).json({
                        paid: paid,
                        unpaid: unpaid,
                        kb: kb
                    });
                }
                
                if(status !== undefined){
                    const query = `
                        JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                        JOIN services_period ON invoices_services.id_services_period = services_period.id
                        JOIN services_company ON services_period.id_services_company = services_company.id
                        JOIN am_company ON am_company.company_id = services_company.id_company
                        JOIN am ON am_company.am_id = am.id 
                        JOIN company ON services_company.id_company = company.id
                        JOIN services ON services_company.id_services = services.id
                        WHERE
                            am_company.am_id = ? AND invoices.paid_unpaid = ? AND company.id = ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                        GROUP BY
                            MONTH(invoices.inv_date)
                        ORDER BY
                            MONTH(invoices.inv_date)
                    `;
                    const data = await getYearlyData(am_id, status, company, services, date_start, date_end, query);
                    return res.status(200).json({
                        data: data
                    });
                }
            }
            if (company === undefined && services === undefined) {
                if(status === undefined){
                    const query = `
                        JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                        JOIN services_period ON invoices_services.id_services_period = services_period.id
                        JOIN services_company ON services_period.id_services_company = services_company.id
                        JOIN am_company ON am_company.company_id = services_company.id_company
                        JOIN am ON am_company.am_id = am.id 
                        JOIN company ON services_company.id_company = company.id
                        JOIN services ON services_company.id_services = services.id
                        WHERE
                            am_company.am_id = ? AND invoices.paid_unpaid = ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                        GROUP BY
                            MONTH(invoices.inv_date)
                        ORDER BY
                            MONTH(invoices.inv_date)
                    `;
                    const paid = await getYearlyData(am_id, 'PAID', company, services, date_start, date_end, query);
                    const unpaid = await getYearlyData(am_id, 'UNPAID', company, services, date_start, date_end, query);
                    const kb = await getYearlyData(am_id, 'KURANG BAYAR', company, services, date_start, date_end, query);
        
                    return res.status(200).json({
                        paid: paid,
                        unpaid: unpaid,
                        kb: kb
                    });
                }

                if(status !== undefined){
                    const query = `
                        JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                        JOIN services_period ON invoices_services.id_services_period = services_period.id
                        JOIN services_company ON services_period.id_services_company = services_company.id
                        JOIN am_company ON am_company.company_id = services_company.id_company
                        JOIN am ON am_company.am_id = am.id 
                        JOIN company ON services_company.id_company = company.id
                        JOIN services ON services_company.id_services = services.id
                        WHERE
                            am_company.am_id = ? AND invoices.paid_unpaid = ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                        GROUP BY
                            MONTH(invoices.inv_date)
                        ORDER BY
                            MONTH(invoices.inv_date)
                    `;
                    const data = await getYearlyData(am_id, status, company, services, date_start, date_end, query);
                    return res.status(200).json({
                        data: data
                    });
                }  
            }
        }        
    } catch (err) {
        console.error("Error:", err);
        return res.status(401).json({ message: "Invalid Server Error." });
    }
});

app.get('/api/status/total', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
    let {date_start, date_end, company, services, am_id} = req.query;
    if(!date_start || !date_end){
        return res.status(400).json({ message: "Masukan Tanggal." });
    }

    date_start = date_start.substring(0, 7);
    date_end = date_end.substring(0, 7);

    let user_id = req.user.id;
    const user_role = req.user.role;

    try{
        if(user_role === 'admin'){
            user_id = undefined;
            if(company !== undefined){
                const query = `
                    FROM
                        invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN company ON services_company.id_company = company.id
                    JOIN services ON services_company.id_services = services.id
                    WHERE
                        company.id = ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                `;
                const result = await getTotalData(user_id, company, services, date_start, date_end, query);
                return res.status(200).json(result);
            }
            if(services !== undefined){
                const query = `
                    FROM
                        invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN company ON services_company.id_company = company.id
                    JOIN services ON services_company.id_services = services.id
                    WHERE
                        services.nama LIKE ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                `;
                const result = await getTotalData(user_id, company, `%${services}%`, date_start, date_end, query);
                return res.status(200).json(result);
                
            }
            if(am_id !== undefined){
                user_id = am_id;
                const query = `
                    FROM
                        invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN am_company ON am_company.company_id = services_company.id_company
                    JOIN am ON am.id = am_company.am_id
                    JOIN company ON services_company.id_company = company.id
                    JOIN services ON services_company.id_services = services.id
                    WHERE
                        am.id = ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                `;
                const result = await getTotalData(user_id, company, services, date_start, date_end, query);
                return res.status(200).json(result);
            }
            if(company === undefined && services === undefined && am_id === undefined){
                const query = `
                    FROM invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN services ON services_company.id_services = services.id
                    JOIN company ON services_company.id_company = company.id
                    WHERE DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                `;
                const result = await getTotalData(user_id, company, services, date_start, date_end, query);
                return res.status(200).json(result);    
            }
        }

        if(user_role === 'AM'){
            const query_id = "SELECT id FROM am WHERE user_id = ?";
            const [result_id] = await dbPromise.query(query_id, user_id);
            const am_id = result_id[0].id;

            if (services !== undefined) {
                const query = `
                    FROM invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN am_company ON am_company.company_id = services_company.id_company
                    JOIN company ON services_company.id_company = company.id
                    JOIN services ON services_company.id_services = services.id
                    WHERE am_company.am_id = ? AND services.id LIKE ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                `;
                const result = await getTotalData(am_id, company, `%${services}%`, date_start, date_end, query);
                return res.status(200).json(result);
            }
            if(company !== undefined){
                const query = `
                    FROM
                        invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN am_company ON am_company.company_id = services_company.id_company
                    JOIN company ON services_company.id_company = company.id
                    JOIN services ON services_company.id_services = services.id
                    WHERE
                        am_company.am_id = ? AND company.id = ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                `;
                const result = await getTotalData(am_id, company, services, date_start, date_end, query);
                return res.status(200).json(result);
            }
            if (company === undefined && services === undefined) {
                const query = `
                    FROM invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN am_company ON am_company.company_id = services_company.id_company
                    JOIN company ON services_company.id_company = company.id
                    JOIN services ON services_company.id_services = services.id
                    WHERE am_company.am_id = ? AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?              
                `;
                const result = await getTotalData(am_id, company, services, date_start, date_end, query);
                return res.status(200).json(result); 
            }
        }        
    } catch (err) {
        console.error("Error:", err);
        return res.status(401).json({ message: "Invalid Server Error." });
    }
});

app.get('/api/total-invoice/chart', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
    let {date_start, date_end} = req.query;
    if(!date_start || !date_end){
        return res.status(400).json({ message: "Masukan Tanggal." });
    }

    date_start = date_start.substring(0, 7);
    date_end = date_end.substring(0, 7);

    const user_id = req.user.id;
    const user_role = req.user.role;
    try {
        if(user_role === 'admin'){
            const query = `
                SELECT
                    COUNT(id) AS total_invoices,
                    SUM(CASE WHEN paid_unpaid = 'PAID' THEN 1 ELSE 0 END) AS total_paid,
                    SUM(CASE WHEN paid_unpaid = 'UNPAID' THEN 1 ELSE 0 END) AS total_unpaid,
                    SUM(CASE WHEN paid_unpaid = 'KURANG BAYAR' THEN 1 ELSE 0 END) AS total_kb,
                    SUM(CASE WHEN paid_unpaid = 'PAID' THEN receive ELSE 0 END) AS total_inv_paid,
                    SUM(CASE WHEN paid_unpaid = 'KURANG BAYAR' THEN total_payment ELSE 0 END) AS total_inv_paid_tambahan,
                    SUM(CASE WHEN paid_unpaid = 'UNPAID' THEN receive ELSE 0 END) AS total_inv_unpaid,
                    SUM(CASE WHEN paid_unpaid = 'KURANG BAYAR' THEN total_kurang_bayar ELSE 0 END) AS total_inv_kb
                FROM invoices
                WHERE inv_date BETWEEN ? AND ?
            `;
            const [result] = await dbPromise.query(query, [date_start, date_end]);

            let {
                total_invoices = 0,
                total_paid = 0,
                total_unpaid = 0,
                total_kb = 0,
                total_inv_paid = 0,
                total_inv_unpaid = 0,
                total_inv_kb = 0,
                total_inv_paid_tambahan = 0
            } = result[0] || {};
            
            total_inv_paid = parseInt(total_inv_paid) + parseInt(total_inv_paid_tambahan);
            const percent_paid = (total_paid/total_invoices)*100;
            const percent_unpaid = (total_unpaid/total_invoices)*100;
            const percent_kb = (total_kb/total_invoices)*100;

            return res.status(200).json({
                total_invoices:[{
                    total: total_invoices,
                    total_paid: total_paid,
                    total_unpaid: total_unpaid,
                    total_kb: total_kb
                }],
                label:[{
                    paid:[{ value: parseInt(total_inv_paid), percent: percent_paid.toFixed(1) }],
                    unpaid:[{ value: parseInt(total_inv_unpaid), percent: percent_unpaid.toFixed(1) }],
                    kb:[{ value: parseInt(total_inv_kb), percent: percent_kb.toFixed(1) }]
                }]
            });
        }

        if(user_role === 'AM'){
            const query_id = "SELECT id FROM am WHERE user_id = ?";
            const [result_id] = await dbPromise.query(query_id, user_id);
            const am_id = result_id[0].id;
            
            const query = `
                SELECT
                    COUNT(invoices.id) AS total_invoices,
                    SUM(CASE WHEN paid_unpaid = 'PAID' THEN 1 ELSE 0 END) AS total_paid,
                    SUM(CASE WHEN paid_unpaid = 'UNPAID' THEN 1 ELSE 0 END) AS total_unpaid,
                    SUM(CASE WHEN paid_unpaid = 'KURANG BAYAR' THEN 1 ELSE 0 END) AS total_kb,
                    SUM(CASE WHEN paid_unpaid = 'PAID' THEN receive ELSE 0 END) AS total_inv_paid,
                    SUM(CASE WHEN paid_unpaid = 'KURANG BAYAR' THEN total_payment ELSE 0 END) AS total_inv_paid_tambahan,
                    SUM(CASE WHEN paid_unpaid = 'UNPAID' THEN receive ELSE 0 END) AS total_inv_unpaid,
                    SUM(CASE WHEN paid_unpaid = 'KURANG BAYAR' THEN total_kurang_bayar ELSE 0 END) AS total_inv_kb
                FROM invoices
                JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                JOIN services_period ON invoices_services.id_services_period = services_period.id
                JOIN services_company ON services_period.id_services_company = services_company.id
                JOIN am_company ON am_company.company_id = services_company.id_company
                JOIN am ON am_company.am_id = am.id 
                JOIN company ON services_company.id_company = company.id
                JOIN services ON services_company.id_services = services.id
                WHERE am.id = ? AND inv_date BETWEEN ? AND ?
            `;
            const [result] = await dbPromise.query(query, [am_id, date_start, date_end]);

            let {
                total_invoices = 0,
                total_paid = 0,
                total_unpaid = 0,
                total_kb = 0,
                total_inv_paid = 0,
                total_inv_unpaid = 0,
                total_inv_kb = 0,
                total_inv_paid_tambahan = 0
            } = result[0] || {};
            
            total_inv_paid = parseInt(total_inv_paid) + parseInt(total_inv_paid_tambahan);
            const percent_paid = (total_paid/total_invoices)*100;
            const percent_unpaid = (total_unpaid/total_invoices)*100;
            const percent_kb = (total_kb/total_invoices)*100;

            return res.status(200).json({
                total_invoices:[{
                    total: total_invoices,
                    total_paid: total_paid,
                    total_unpaid: total_unpaid,
                    total_kb: total_kb
                }],
                label:[{
                    paid:[{ value: parseInt(total_inv_paid), percent: percent_paid.toFixed(1) }],
                    unpaid:[{ value: parseInt(total_inv_unpaid), percent: percent_unpaid.toFixed(1) }],
                    kb:[{ value: parseInt(total_inv_kb), percent: percent_kb.toFixed(1) }]
                }]
            });
        }
        
    } catch (err) {
        console.error("Error:", err);
        return res.status(401).json({ message: "Invalid Server Error." });
    }
});

app.get('/api/total-invoice/table', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
    let {date_start, date_end, status, company, am_id} = req.query
    if(!date_start || !date_end){
        return res.status(400).json({ message: "Masukan Tanggal." });
    }

    date_start = date_start.substring(0, 7);
    date_end = date_end.substring(0, 7);

    let user_id = req.user.id;
    const user_role = req.user.role;

    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    let offset = (page - 1) * limit;

    try {
        if(user_role === 'admin'){
            if(status === undefined){
                const [result_1, result_2, result_3] = await Promise.all([
                    executeQueryByStatus(am_id, company, 'PAID', date_start, date_end, limit, offset),
                    executeQueryByStatus(am_id, company, 'UNPAID', date_start, date_end, limit, offset),
                    executeQueryByStatus(am_id, company, 'KURANG BAYAR', date_start, date_end, limit, offset)
                ]);
            
                const combinedResult = {
                    page: Math.ceil(offset / limit) + 1,
                    totalPages: Math.max(result_1.totalPages, result_2.totalPages, result_3.totalPages),
                    count: result_1.count + result_2.count + result_3.count,
                    data: [...result_1.data, ...result_2.data, ...result_3.data]
                };
                return res.status(200).json(combinedResult);
            }
            if(status !== undefined){
                console.log(status);
                const result = await executeQueryByStatus(am_id, company, status, date_start, date_end, limit, offset);
                return res.status(200).json({
                    page: Math.ceil(offset / limit) + 1,
                    totalPages: result.totalPages,
                    count: result.count,
                    data: [...result.data]
                });
            }
                   
        }
    } catch (err) {
        console.error("Error:", err);
        return res.status(401).json({ message: "Invalid Server Error." });
    }

});

app.get('/api/top', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
    let {date_start, date_end} = req.query;
    if(!date_start || !date_end){
        return res.status(400).json({ message: "Masukan Tanggal." });
    }

    date_start = date_start.substring(0, 7);
    date_end = date_end.substring(0, 7);

    const user_id = req.user.id;
    const user_role = req.user.role;

    try {
        if(user_role === 'admin'){
            const query_company =  `
                SELECT
                    company.nama,
                    SUM(CASE WHEN invoices.paid_unpaid = 'PAID' THEN invoices.total_inv ELSE 0 END) AS total_inv_paid
                FROM company
                JOIN services_company ON company.id = services_company.id_company
                JOIN services_period ON services_company.id = services_period.id_services_company
                JOIN invoices_services ON services_period.id = invoices_services.id_services_period
                JOIN invoices ON invoices.id = invoices_services.id_invoices
                WHERE invoices.paid_unpaid = 'PAID' AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                GROUP BY company.nama
                ORDER BY total_inv_paid DESC
                LIMIT 5 OFFSET 0
            `;
            const [result_company] = await dbPromise.query(query_company, [date_start, date_end]);

            const query_services = `
                SELECT
                    service_group AS service_name,
                    SUM(CASE WHEN grouped_services.paid_unpaid = 'PAID' THEN grouped_services.total_inv ELSE 0 END) AS total_inv_paid
                FROM (
                    SELECT
                        services.nama,
                        invoices.paid_unpaid,
                        invoices.total_inv,
                        CASE
                            WHEN services.nama LIKE '%COLOCATION%' THEN 'COLOCATION'
                            WHEN services.nama LIKE '%DARK FIBER%' THEN 'DARK FIBER'
                            WHEN services.nama LIKE '%LEASED LINE%' THEN 'LEASED LINE'
                            WHEN services.nama LIKE '%LEASED CORE%' THEN 'LEASED CORE'
                            WHEN services.nama LIKE '%FIBER%' THEN 'FIBER'
                            ELSE 'OTHER'
                        END AS service_group
                    FROM services
                    JOIN services_company ON services.id = services_company.id_services
                    JOIN services_period ON services_company.id = services_period.id_services_company
                    JOIN invoices_services ON services_period.id = invoices_services.id_services_period
                    JOIN invoices ON invoices.id = invoices_services.id_invoices
                    WHERE invoices.paid_unpaid = 'PAID' AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                ) AS grouped_services
                WHERE
                    service_group IS NOT NULL
                GROUP BY
                    service_group
                ORDER BY
                    total_inv_paid DESC
                LIMIT 5 OFFSET 0
            `;
            const [result_services] = await dbPromise.query(query_services, [date_start, date_end]);
            
            const query_aging = `
                SELECT
                company.nama,
                DATEDIFF(
                    CURDATE(), DATE_ADD(
                        invoices.inv_date,
                        INTERVAL 2 WEEK
                    )) AS total_days
                FROM
                    company
                JOIN services_company ON company.id = services_company.id_company
                JOIN services_period ON services_company.id = services_period.id_services_company
                JOIN invoices_services ON services_period.id = invoices_services.id_services_period
                JOIN invoices ON invoices.id = invoices_services.id_invoices
                WHERE
                    invoices.paid_unpaid = 'PAID' AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                ORDER BY total_days DESC
                LIMIT 5 OFFSET 0
            `;
            const [result_aging] = await dbPromise.query(query_aging, [date_start, date_end]);

            const query_unpaid =  `
                SELECT
                    company.nama,
                    SUM(CASE WHEN invoices.paid_unpaid = 'UNPAID' THEN invoices.total_inv ELSE 0 END) AS total_inv_unpaid
                FROM company
                JOIN services_company ON company.id = services_company.id_company
                JOIN services_period ON services_company.id = services_period.id_services_company
                JOIN invoices_services ON services_period.id = invoices_services.id_services_period
                JOIN invoices ON invoices.id = invoices_services.id_invoices
                WHERE invoices.paid_unpaid = 'UNPAID' AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                GROUP BY company.nama
                ORDER BY total_inv_unpaid DESC
                LIMIT 5 OFFSET 0
            `;
            const [result_unpaid] = await dbPromise.query(query_unpaid, [date_start, date_end]);
            
            const query_am_paid = `
                SELECT am.nama, SUM(invoices.receive) AS total_receive
                FROM am
                JOIN am_company ON am.id = am_company.am_id
                JOIN company ON am_company.company_id = company.id
                JOIN services_company ON company.id = services_company.id_company
                JOIN services_period ON services_company.id = services_period.id_services_company
                JOIN invoices_services ON services_period.id = invoices_services.id_services_period
                JOIN invoices ON invoices_services.id_invoices = invoices.id
                WHERE invoices.paid_unpaid = 'PAID' AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                GROUP BY am.nama
                ORDER BY total_receive DESC
                LIMIT 5 OFFSET 0
            `;
            const [result_am_paid] = await dbPromise.query(query_am_paid, [date_start, date_end]);

            const query_am_unpaid = `
                SELECT am.nama, SUM(invoices.receive) AS total_receive
                FROM am
                JOIN am_company ON am.id = am_company.am_id
                JOIN company ON am_company.company_id = company.id
                JOIN services_company ON company.id = services_company.id_company
                JOIN services_period ON services_company.id = services_period.id_services_company
                JOIN invoices_services ON services_period.id = invoices_services.id_services_period
                JOIN invoices ON invoices_services.id_invoices = invoices.id
                WHERE invoices.paid_unpaid = 'UNPAID' AND DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?
                GROUP BY am.nama
                ORDER BY total_receive DESC
                LIMIT 5 OFFSET 0
            `;
            const [result_am_unpaid] = await dbPromise.query(query_am_unpaid, [date_start, date_end]);

            return res.status(200).json({
                company: result_company,
                services: result_services,
                unpaid: result_unpaid,
                aging: result_aging,
                am_paid: result_am_paid,
                am_unpaid: result_am_unpaid
            });
        }
        if(user_role === 'AM'){
            const query_company =  `
                SELECT
                    company.nama,
                    SUM(CASE WHEN invoices.paid_unpaid = 'PAID' THEN invoices.total_inv ELSE 0 END) AS total_inv_paid
                FROM company
                JOIN services_company ON company.id = services_company.id_company
                JOIN am_company ON am_company.company_id = services_company.id_company
                JOIN services_period ON services_company.id = services_period.id_services_company
                JOIN invoices_services ON services_period.id = invoices_services.id_services_period
                JOIN invoices ON invoices.id = invoices_services.id_invoices
                WHERE invoices.paid_unpaid = 'PAID' AND user_id = ?
                GROUP BY company.nama
                ORDER BY total_inv_paid DESC
                LIMIT 0, 5
            `;
            const [result_company] = await dbPromise.query(query_company, user_id);

            const query_services = `
                SELECT
                    service_group AS service_name,
                    SUM(
                        CASE WHEN grouped_services.paid_unpaid = 'PAID' THEN grouped_services.total_inv ELSE 0
                    END
                ) AS total_inv_paid
                FROM
                (
                    SELECT
                        services.nama,
                        invoices.paid_unpaid,
                        invoices.total_inv,
                        CASE 
                            WHEN services.nama LIKE '%COLOCATION%' THEN 'COLOCATION' 
                            WHEN services.nama LIKE '%DARK FIBER%' THEN 'DARK FIBER' 
                            WHEN services.nama LIKE '%LEASED LINE%' THEN 'LEASED LINE' 
                            WHEN services.nama LIKE '%LEASED CORE%' THEN 'LEASED CORE' 
                            WHEN services.nama LIKE '%FIBER%' THEN 'FIBER' 
                            ELSE 'OTHER'
                        END AS service_group
                    FROM
                        services
                    JOIN services_company ON services.id = services_company.id_services
                    JOIN am_company ON am_company.company_id = services_company.id_company
                    JOIN services_period ON services_company.id = services_period.id_services_company
                    JOIN invoices_services ON services_period.id = invoices_services.id_services_period
                    JOIN invoices ON invoices.id = invoices_services.id_invoices
                    WHERE
                        invoices.paid_unpaid = 'PAID' 
                        AND am_company.user_id = ?
                ) AS grouped_services
                WHERE
                    service_group IS NOT NULL
                GROUP BY
                    service_group
                ORDER BY
                    total_inv_paid DESC
                LIMIT 0, 5
            `;
            const [result_services] = await dbPromise.query(query_services, user_id);
            return res.status(200).json({
                company : result_company,
                services : result_services
            });
        }

    } catch (err) {
        console.error("Error:", err);
        return res.status(401).json({ message: "Invalid Server Error." });
    }
});

app.get('/api/data', api_key, verify_token, authorize(['admin', 'AM']), async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;
    let {company, services, brand, term, inv_date_start, inv_date_end, status, payment_date_start, payment_date_end} = req.query;

    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    let offset = (page - 1) * limit;

    let total, total_pages;
    
    let user_q = "";
    let company_q = "";
    let services_q = "";
    let brand_q = "";
    let term_q = "";
    let inv_date_q = "";
    let status_q = "";
    let payment_date_q = "";

    if(user_role === 'AM' && user_id !== undefined){
        user_q = `am_company.am_id = ?`
    }
    if(company !== undefined){
        company_q = `company.id = ?`;
    }
    if(services !== undefined){
        services_q = `services.nama LIKE ?`;
        services = `%${services}%`;
    }
    if(brand !== undefined){
        brand_q = `company.brand LIKE ?`;
        brand = `%${brand}%`;
    }
    if(term !== undefined){
        term_q = `services_period.term LIKE ?`;
        term = `%${term}%`; 
    }
    if(inv_date_start !== undefined && inv_date_end !== undefined){
        inv_date_q = `DATE_FORMAT(invoices.inv_date, '%Y-%m') BETWEEN ? AND ?`;
        inv_date_start = inv_date_start.substring(0, 7);
        inv_date_end = inv_date_end.substring(0, 7);
    }
    if(status !== undefined){
        status_q = `invoices.paid_unpaid LIKE ?`;
        status = `%${status}%`;  
    }
    if(payment_date_start !== undefined && payment_date_end !== undefined){
        payment_date_q = `DATE_FORMAT(invoices.payment_date, '%Y-%m') BETWEEN ? AND ?`;
        payment_date_start = payment_date_start.substring(0, 7);
        payment_date_end = payment_date_end.substring(0, 7);
    }
    
    let query_tambahan = [user_q, company_q, services_q, brand_q, term_q, inv_date_q, status_q, payment_date_q]
        .filter(Boolean) 
        .join(' AND ');

    if (query_tambahan) {
        query_tambahan = 'WHERE ' + query_tambahan;
    }

    const query_order = `
        ORDER BY
            invoices.id ASC
        LIMIT ? OFFSET ?
    `;

    try{
        if(user_role === 'admin'){
            const params = [company, services, brand, term, inv_date_start, inv_date_end, status, payment_date_start, payment_date_end, limit, offset].filter(param => param !== undefined && param !== null);
            if (company !== undefined) {
                const query_1 = `
                    SELECT COUNT(*) AS total FROM invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN services ON services_company.id_services = services.id
                    JOIN company ON services_company.id_company = company.id 
                `;
                const fullQuery_1 = `${query_1} ${query_tambahan}`;
                const [result_1] = await dbPromise.query(fullQuery_1, params.length ? params : undefined);
                total = result_1[0].total;
                total_pages = Math.ceil(total / limit);
        
                const query_2 = `
                    SELECT
                        invoices.id,
                        invoices.status_1,
                        invoices.nomor_invoice,
                        company.nama AS company_name,
                        company.brand,
                        services.nama AS services_name,
                        services_period.term,
                        services_period.period_start,
                        services_period.period_end,
                        invoices.status_2,
                        invoices.inv_no,
                        invoices.so_no,
                        invoices.mo_bast,
                        invoices.inv_date,
                        invoices.inv_amount_dpp,
                        invoices.ppn_11,
                        invoices.total_inv,
                        invoices.pph_2,
                        invoices.receive,
                        invoices.paid_unpaid,
                        invoices.total_payment,
                        invoices.payment_date
                    FROM
                        invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN services ON services_company.id_services = services.id 
                    JOIN company ON services_company.id_company = company.id 
                `;
                const fullQuery_2 = `${query_2} ${query_tambahan} ${query_order}`;
                const [result_2] = await dbPromise.query(fullQuery_2, params.length ? params : undefined);
                return res.status(200).json({
                    page: page,
                    totalPages: total_pages,
                    count: total,
                    data: result_2
                }); 
            }
            if (services !== undefined) {
                const query_1 = `
                    SELECT COUNT(*) AS total FROM invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN services ON services_company.id_services = services.id
                    JOIN company ON services_company.id_company = company.id  
                `;
                const fullQuery_1 = `${query_1} ${query_tambahan}`;
                const [result_1] = await dbPromise.query(fullQuery_1, params.length ? params : undefined);
                total = result_1[0].total;
                total_pages = Math.ceil(total / limit);
        
                const query_2 = `
                    SELECT
                        invoices.id,
                        invoices.status_1,
                        invoices.nomor_invoice,
                        company.nama AS company_name,
                        company.brand,
                        services.nama AS services_name,
                        services_period.term,
                        services_period.period_start,
                        services_period.period_end,
                        invoices.status_2,
                        invoices.inv_no,
                        invoices.so_no,
                        invoices.mo_bast,
                        invoices.inv_date,
                        invoices.inv_amount_dpp,
                        invoices.ppn_11,
                        invoices.total_inv,
                        invoices.pph_2,
                        invoices.receive,
                        invoices.paid_unpaid,
                        invoices.total_payment,
                        invoices.payment_date
                    FROM
                        invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN services ON services_company.id_services = services.id
                    JOIN company ON services_company.id_company = company.id  
                `;
                const fullQuery_2 = `${query_2} ${query_tambahan} ${query_order}`;
                const [result_2] = await dbPromise.query(fullQuery_2, params.length ? params : undefined);
                return res.status(200).json({
                    page: page,
                    totalPages: total_pages,
                    count: total,
                    data: result_2
                }); 
            }
            if (company === undefined && services === undefined) {
                const query_1 = `
                    SELECT COUNT(*) AS total FROM invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN services ON services_company.id_services = services.id
                    JOIN company ON services_company.id_company = company.id 
                `;
                const fullQuery_1 = `${query_1} ${query_tambahan}`;
                const [result_1] = await dbPromise.query(fullQuery_1, params.length ? params : undefined);
                total = result_1[0].total;
                total_pages = Math.ceil(total / limit);
        
                const query_2 = `
                    SELECT
                        invoices.id,
                        invoices.status_1,
                        invoices.nomor_invoice,
                        company.nama AS company_name,
                        company.brand,
                        services.nama AS services_name,
                        services_period.term,
                        services_period.period_start,
                        services_period.period_end,
                        invoices.status_2,
                        invoices.inv_no,
                        invoices.so_no,
                        invoices.mo_bast,
                        invoices.inv_date,
                        invoices.inv_amount_dpp,
                        invoices.ppn_11,
                        invoices.total_inv,
                        invoices.pph_2,
                        invoices.receive,
                        invoices.paid_unpaid,
                        invoices.total_payment,
                        invoices.payment_date
                    FROM
                        invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN services ON services_company.id_services = services.id
                    JOIN company ON services_company.id_company = company.id 
                `;
                const fullQuery_2 = `${query_2} ${query_tambahan} ${query_order}`;
                const [result_2] = await dbPromise.query(fullQuery_2, params.length ? params : undefined);
                return res.status(200).json({
                    page: page,
                    totalPages: total_pages,
                    count: total,
                    data: result_2
                }); 
            }
        }
        if (user_role === 'AM'){
            const query = "SELECT id FROM am WHERE user_id = ?";
            const [result] = await dbPromise.query(query, user_id);
            const am_id = result[0].id;

            const params = [am_id, company, services, brand, term, inv_date_start, inv_date_end, status, payment_date_start, payment_date_end, limit, offset].filter(param => param !== undefined && param !== null);
            if (company !== undefined) {
                const query_1 = `
                    SELECT COUNT(*) AS total FROM invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN am_company ON am_company.company_id = services_company.id_company
                    JOIN company ON services_company.id_company = company.id
                    JOIN services ON services_company.id_services = services.id  
                `;
                const fullQuery_1 = `${query_1} ${query_tambahan}`;
                const [result_1] = await dbPromise.query(fullQuery_1, params.length ? params : undefined);
                total = result_1[0].total;
                total_pages = Math.ceil(total / limit);
        
                const query_2 = `
                    SELECT
                        invoices.id,
                        invoices.status_1,
                        invoices.nomor_invoice,
                        company.nama AS company_name,
                        company.brand,
                        services.nama AS services_name,
                        services_period.term,
                        services_period.period_start,
                        services_period.period_end,
                        invoices.status_2,
                        invoices.inv_no,
                        invoices.so_no,
                        invoices.mo_bast,
                        invoices.inv_date,
                        invoices.inv_amount_dpp,
                        invoices.ppn_11,
                        invoices.total_inv,
                        invoices.pph_2,
                        invoices.receive,
                        invoices.paid_unpaid,
                        invoices.total_payment,
                        invoices.payment_date
                    FROM
                        invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN am_company ON am_company.company_id = services_company.id_company
                    JOIN services ON services_company.id_services = services.id
                    JOIN company ON services_company.id_company = company.id 
                `;
                const fullQuery_2 = `${query_2} ${query_tambahan} ${query_order}`;
                const [result_2] = await dbPromise.query(fullQuery_2, params.length ? params : undefined);
                return res.status(200).json({
                    page: page,
                    totalPages: total_pages,
                    count: total,
                    data: result_2
                }); 
            }
            if (services !== undefined) {
                const query_1 = `
                    SELECT COUNT(*) AS total FROM invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN am_company ON am_company.company_id = services_company.id_company
                    JOIN company ON services_company.id_company = company.id
                    JOIN services ON services_company.id_services = services.id 
                `;
                const fullQuery_1 = `${query_1} ${query_tambahan}`;
                const [result_1] = await dbPromise.query(fullQuery_1, params.length ? params : undefined);
                total = result_1[0].total;
                total_pages = Math.ceil(total / limit);
        
                const query_2 = `
                    SELECT
                        invoices.id,
                        invoices.status_1,
                        invoices.nomor_invoice,
                        company.nama AS company_name,
                        company.brand,
                        services.nama AS services_name,
                        services_period.term,
                        services_period.period_start,
                        services_period.period_end,
                        invoices.status_2,
                        invoices.inv_no,
                        invoices.so_no,
                        invoices.mo_bast,
                        invoices.inv_date,
                        invoices.inv_amount_dpp,
                        invoices.ppn_11,
                        invoices.total_inv,
                        invoices.pph_2,
                        invoices.receive,
                        invoices.paid_unpaid,
                        invoices.total_payment,
                        invoices.payment_date
                    FROM
                        invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN am_company ON am_company.company_id = services_company.id_company
                    JOIN services ON services_company.id_services = services.id
                    JOIN company ON services_company.id_company = company.id 
                `;
                const fullQuery_2 = `${query_2} ${query_tambahan} ${query_order}`;
                const [result_2] = await dbPromise.query(fullQuery_2, params.length ? params : undefined);
                return res.status(200).json({
                    page: page,
                    totalPages: total_pages,
                    count: total,
                    data: result_2
                }); 
            }
            if (company === undefined && services === undefined) {
                const query_1 = `
                    SELECT COUNT(*) AS total FROM invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN am_company ON am_company.company_id = services_company.id_company
                    JOIN company ON services_company.id_company = company.id 
                    JOIN services ON services_company.id_services = services.id
                `;
                const fullQuery_1 = `${query_1} ${query_tambahan}`;
                const [result_1] = await dbPromise.query(fullQuery_1, params.length ? params : undefined);
                total = result_1[0].total;
                total_pages = Math.ceil(total / limit);
        
                const query_2 = `
                    SELECT
                        invoices.id,
                        invoices.status_1,
                        invoices.nomor_invoice,
                        company.nama AS company_name,
                        company.brand,
                        services.nama AS services_name,
                        services_period.term,
                        services_period.period_start,
                        services_period.period_end,
                        invoices.status_2,
                        invoices.inv_no,
                        invoices.so_no,
                        invoices.mo_bast,
                        invoices.inv_date,
                        invoices.inv_amount_dpp,
                        invoices.ppn_11,
                        invoices.total_inv,
                        invoices.pph_2,
                        invoices.receive,
                        invoices.paid_unpaid,
                        invoices.total_payment,
                        invoices.payment_date
                    FROM
                        invoices
                    JOIN invoices_services ON invoices.id = invoices_services.id_invoices
                    JOIN services_period ON invoices_services.id_services_period = services_period.id
                    JOIN services_company ON services_period.id_services_company = services_company.id
                    JOIN am_company ON am_company.company_id = services_company.id_company
                    JOIN services ON services_company.id_services = services.id
                    JOIN company ON services_company.id_company = company.id  
                `;
                const fullQuery_2 = `${query_2} ${query_tambahan} ${query_order}`;
                const [result_2] = await dbPromise.query(fullQuery_2, params.length ? params : undefined);
                return res.status(200).json({
                    page: page,
                    totalPages: total_pages,
                    count: total,
                    data: result_2
                }); 
            }
        }
    } catch (err) {
        console.error("Error:", err);
        return res.status(401).json({ message: "Invalid Server Error." });
    }
});


module.exports = app;