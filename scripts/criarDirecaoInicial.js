require('dotenv').config();
const crypto = require('crypto');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const args = process.argv.slice(2);
const valor = (nome) => {
    const i = args.indexOf(`--${nome}`);
    return i >= 0 ? args[i + 1] : undefined;
};
function senhaForte() {
    const grupos = ['ABCDEFGHJKLMNPQRSTUVWXYZ','abcdefghijkmnopqrstuvwxyz','23456789','!@#$%&*+-_='];
    const todos = grupos.join('');
    const pick = s => s[crypto.randomInt(s.length)];
    const chars = grupos.map(pick);
    while (chars.length < 16) chars.push(pick(todos));
    for (let i=chars.length-1;i>0;i--) { const j=crypto.randomInt(i+1); [chars[i],chars[j]]=[chars[j],chars[i]]; }
    return chars.join('');
}

async function main() {
    const rl = readline.createInterface({ input, output });
    try {
        const nome = valor('nome') || await rl.question('Nome completo: ');
        const email = (valor('email') || await rl.question('E-mail: ')).trim().toLowerCase();
        const matricula = valor('matricula') || await rl.question('Matrícula: ');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || undefined,
            host: process.env.DATABASE_URL ? undefined : process.env.DB_HOST,
            port: process.env.DATABASE_URL ? undefined : process.env.DB_PORT,
            user: process.env.DATABASE_URL ? undefined : process.env.DB_USER,
            password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
            database: process.env.DATABASE_URL ? undefined : process.env.DB_NAME,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
        });
        try {
            const existe = await pool.query(`SELECT 1 FROM usuarios WHERE perfil='DIRECAO' AND senha IS NOT NULL LIMIT 1`);
            if (existe.rowCount && !args.includes('--forcar')) throw new Error('Já existe uma conta DIRECAO ativa. Use --forcar somente se precisar criar outra.');
            if (!nome.trim() || !email.includes('@') || !String(matricula).trim()) throw new Error('Nome, e-mail e matrícula são obrigatórios.');
            const password = senhaForte();
            const hash = await bcrypt.hash(password, 10);
            await pool.query(
                `INSERT INTO usuarios (nome,email,matricula,senha,perfil,deve_trocar_senha)
                 VALUES ($1,$2,$3,$4,'DIRECAO',TRUE)`,
                [nome.trim(),email,String(matricula).trim(),hash]
            );
            output.write(`Direção inicial criada. Senha provisória (exibida uma única vez): ${password}\n`);
        } finally { await pool.end(); }
    } finally { rl.close(); }
}

main().catch((erro) => { console.error(`[criar-direcao] ${erro.message}`); process.exitCode = 1; });
