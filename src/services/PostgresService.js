
const { Pool } = require('pg');

class PostgresService {
    constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
        });

        this.pool.on('error', (err, client) => {
            console.error('Unexpected error on idle client', err);
            process.exit(-1);
        });
    }

    async query(text, params) {
        const client = await this.pool.connect();
        try {
            const res = await client.query(text, params);
            return res.rows;
        } finally {
            client.release();
        }
    }

    async getClient() {
        return this.pool.connect();
    }
    async insertCompany(name) {
        const res = await this.query(
            'INSERT INTO companies(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name = EXCLUDED.name RETURNING id, name',
            [name]
        );
        return res[0];
    }

    async getCompanyByName(name) {
        const res = await this.query('SELECT id, name FROM companies WHERE name = $1', [name]);
        return res[0];
    }

    async insertJobDescription(companyId, title, description) {
        const res = await this.query(
            'INSERT INTO job_descriptions(company_id, title, description) VALUES($1, $2, $3) RETURNING id, title, description',
            [companyId, title, description]
        );
        return res[0];
    }

    async insertResume(candidateName, filePath, extractedText, structuredData) {
        const res = await this.query(
            'INSERT INTO resumes(candidate_name, file_path, extracted_text, structured_data) VALUES($1, $2, $3, $4) RETURNING id, candidate_name',
            [candidateName, filePath, extractedText, structuredData]
        );
        return res[0];
    }

    async getResumeById(id) {
        const res = await this.query('SELECT * FROM resumes WHERE id = $1', [id]);
        return res[0];
    }
}

module.exports = new PostgresService();
