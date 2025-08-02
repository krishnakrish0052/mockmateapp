
const { Pool } = require('pg');

class PostgresService {
    constructor() {
        this.isEnabled = process.env.DB_USER && process.env.DB_PASSWORD;
        
        if (this.isEnabled) {
            this.pool = new Pool({
                user: process.env.DB_USER,
                host: process.env.DB_HOST || 'localhost',
                database: process.env.DB_NAME || 'mockmate',
                password: process.env.DB_PASSWORD,
                port: process.env.DB_PORT || 5432,
            });

            this.pool.on('error', (err, client) => {
                console.error('Unexpected error on idle client', err);
                // Don't exit the process, just log the error
                this.isEnabled = false;
            });
        } else {
            console.log('PostgresService: Database connection disabled - missing environment variables');
        }
    }

    async query(text, params) {
        if (!this.isEnabled) {
            throw new Error('Database connection is disabled');
        }
        const client = await this.pool.connect();
        try {
            const res = await client.query(text, params);
            return res.rows;
        } finally {
            client.release();
        }
    }

    async getClient() {
        if (!this.isEnabled) {
            throw new Error('Database connection is disabled');
        }
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
