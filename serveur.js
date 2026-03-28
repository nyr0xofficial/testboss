const express = require('express');
const path = require('path');
const { kv } = require('@vercel/kv');

const app = express();

// Mot de passe admin — à changer et à mettre dans une variable d'environnement
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname));

// Route pour servir la page admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Route POST : recevoir et sauvegarder les données du formulaire
app.post('/api/envoyer', async (req, res) => {
    try {
        const { nom, email, message } = req.body;

        // Validation côté serveur
        if (!nom || !email || !message) {
            return res.status(400).send('Tous les champs sont requis.');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).send('Email invalide.');
        }

        const nouvelleSoumission = {
            nom: nom.trim(),
            email: email.trim().toLowerCase(),
            message: message.trim(),
            date: new Date().toISOString()
        };

        await kv.lpush('soumissions', JSON.stringify(nouvelleSoumission));
        console.log(`✅ Nouvelle soumission de ${nom}`);

        res.send(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Merci !</title>
                <link href="https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans&display=swap" rel="stylesheet">
                <style>
                    body { background:#0a0a0f; color:#f0f0ff; font-family:'DM Sans',sans-serif;
                           display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
                    .box { text-align:center; }
                    h1 { font-family:'Syne',sans-serif; font-size:2.5rem; margin-bottom:1rem; }
                    p { color:#7a7a9a; margin-bottom:2rem; }
                    a { color:#7c6aff; text-decoration:none; font-weight:500; }
                    a:hover { text-decoration:underline; }
                </style>
            </head>
            <body>
                <div class="box">
                    <div style="font-size:3rem;margin-bottom:1rem">✅</div>
                    <h1>Merci ${nouvelleSoumission.nom} !</h1>
                    <p>Votre message a bien été enregistré.</p>
                    <a href="/">← Retour au formulaire</a>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Erreur KV :', error);
        res.status(500).send('Erreur serveur. Veuillez réessayer.');
    }
});

// Route GET : récupérer toutes les soumissions (protégée par mot de passe)
app.get('/api/voir', async (req, res) => {
    const pwd = req.headers['x-admin-password'];
    if (pwd !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Non autorisé' });
    }

    try {
        const raw = await kv.lrange('soumissions', 0, -1);
        const soumissions = raw.map(s => JSON.parse(s));
        res.json(soumissions);
    } catch (error) {
        console.error('Erreur lecture KV :', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = app;
