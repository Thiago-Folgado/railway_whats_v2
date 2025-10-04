const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());

app.use((req, res, next) => {
    console.log(`\n=== REQUISIÇÃO RECEBIDA ===`);
    console.log(`Método: ${req.method}`);
    console.log(`URL: ${req.url}`);
    console.log('============================\n');
    next();
});

let whatsappReady = false;
let currentQRCode = null;
let qrString = '';

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "whatsapp-session" }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    }
});

// CONFIGURAÇÃO COM SIGLAS
const configuracaoProdutos = {
    "Protocolo Desinflama": {
        link: "https://dramarianasuzuki.com.br/ficha-de-matricula",
        grupo: "Protocolo Desinflama - Alunas",
        sigla: "PD"
    },
    "Protocolo O Fim do Lipedema": {
        link: "https://forms.gle/6kcb4EgmZ5RKe8Mo8",
        grupo: "O Fim do Lipedema - Alunas",
        sigla: "OFL"
    }
};

client.on('qr', async (qr) => {
    console.log('\n🔗 QR CODE GERADO!');
    qrString = qr;
    qrcode.generate(qr, { small: true });
    
    try {
        const qrPath = path.join(__dirname, 'qrcode.png');
        await QRCode.toFile(qrPath, qr, { width: 300, margin: 2 });
        currentQRCode = qrPath;
    } catch (err) {
        console.error('Erro ao salvar QR:', err);
    }
});

app.get('/qr', (req, res) => {
    if (currentQRCode && fs.existsSync(currentQRCode)) {
        res.sendFile(path.resolve(currentQRCode));
    } else if (qrString) {
        QRCode.toBuffer(qrString, (err, buffer) => {
            if (err) return res.status(500).send('Erro');
            res.type('png').send(buffer);
        });
    } else {
        res.status(404).send('QR code não gerado');
    }
});

app.get('/qr-page', (req, res) => {
    if (!qrString) {
        return res.send(`<!DOCTYPE html><html><body style="text-align:center;padding:50px"><h1>⏳ Aguardando QR...</h1><script>setTimeout(() => location.reload(), 5000);</script></body></html>`);
    }
    
    QRCode.toDataURL(qrString, { width: 300 }, (err, url) => {
        if (err) return res.status(500).send('Erro');
        res.send(`<!DOCTYPE html><html><body style="text-align:center;padding:50px"><h1>📱 QR Code</h1><img src="${url}" style="border:2px solid #25D366;padding:20px"><p>Escaneie com WhatsApp Business</p></body></html>`);
    });
});

client.on('ready', () => {
    console.log('✅ WHATSAPP CONECTADO!');
    whatsappReady = true;
    currentQRCode = null;
    qrString = '';
});

client.on('disconnected', (reason) => {
    console.log('❌ Desconectado:', reason);
    whatsappReady = false;
});

// Verificar número
async function verificarNumeroWhatsApp(numero) {
    console.log(`\n🔍 Verificando: ${numero}`);
    
    const numeroLimpo = numero.replace(/\D/g, '');
    let numeroBase = numeroLimpo.startsWith('55') ? numeroLimpo : '55' + numeroLimpo;
    
    console.log(`📏 Tamanho: ${numeroBase.length} dígitos`);
    
    if (numeroBase.length === 13) {
        const ddd = numeroBase.substring(2, 4);
        const numeroSemDDD = numeroBase.substring(4);
        const formato8Digitos = '55' + ddd + numeroSemDDD.substring(1);
        
        console.log(`🔄 Tentando 8 dígitos: ${formato8Digitos}`);
        try {
            const resultado8 = await client.getNumberId(formato8Digitos);
            if (resultado8) {
                console.log(`✅ Encontrado com 8 dígitos!`);
                return formato8Digitos + '@c.us';
            }
        } catch (err) {
            console.log(`❌ Não encontrado com 8`);
        }
        
        console.log(`🔄 Tentando 9 dígitos: ${numeroBase}`);
        try {
            const resultado9 = await client.getNumberId(numeroBase);
            if (resultado9) {
                console.log(`✅ Encontrado com 9 dígitos!`);
                return numeroBase + '@c.us';
            }
        } catch (err) {
            console.log(`❌ Não encontrado com 9`);
        }
    }
    
    if (numeroBase.length === 12) {
        console.log(`🔄 Formato padrão: ${numeroBase}`);
        try {
            const resultado = await client.getNumberId(numeroBase);
            if (resultado) {
                console.log(`✅ Encontrado!`);
                return numeroBase + '@c.us';
            }
        } catch (err) {
            console.log(`❌ Não encontrado`);
        }
    }
    
    console.log(`❌ Número não encontrado\n`);
    return null;
}

async function formatarNumero(numero) {
    const numeroValido = await verificarNumeroWhatsApp(numero);
    if (!numeroValido) {
        throw new Error(`Número não encontrado: ${numero}`);
    }
    return numeroValido;
}

// NOVA FUNÇÃO: Adicionar etiqueta
async function adicionarEtiqueta(numeroFormatado, nomeEtiqueta) {
    try {
        console.log(`\n🏷️  Adicionando etiqueta: "${nomeEtiqueta}"`);
        
        const chat = await client.getChatById(numeroFormatado);
        console.log(`✅ Chat encontrado`);
        
        if (typeof chat.addLabel !== 'function') {
            console.log(`⚠️  addLabel não disponível`);
            console.log(`💡 Execute: npm install whatsapp-web.js@latest\n`);
            return false;
        }
        
        const labels = await client.getLabels();
        console.log(`📋 Etiquetas: ${labels.length}`);
        
        if (labels.length > 0) {
            labels.forEach(l => console.log(`   • ${l.name}`));
        }
        
        const etiqueta = labels.find(l => l.name === nomeEtiqueta);
        
        if (!etiqueta) {
            console.log(`\n⚠️  Etiqueta "${nomeEtiqueta}" não existe!`);
            console.log(`💡 Crie no WhatsApp Business primeiro\n`);
            return false;
        }
        
        console.log(`✅ Encontrada: "${etiqueta.name}"`);
        await chat.addLabel(etiqueta.id);
        console.log(`✅ Etiqueta adicionada!\n`);
        return true;
        
    } catch (error) {
        console.error(`❌ Erro: ${error.message}\n`);
        return false;
    }
}

async function encontrarGrupo(nomeGrupo) {
    try {
        const chats = await client.getChats();
        return chats.find(chat => chat.isGroup && chat.name === nomeGrupo);
    } catch (error) {
        return null;
    }
}

async function adicionarAoGrupo(numeroFormatado, nomeGrupo) {
    try {
        const grupo = await encontrarGrupo(nomeGrupo);
        if (!grupo) {
            console.log(`❌ Grupo não encontrado`);
            return false;
        }
        await grupo.addParticipants([numeroFormatado]);
        console.log(`✅ Adicionado ao grupo`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao adicionar:`, error);
        return false;
    }
}

async function removerDeOutrosGrupos(numeroFormatado, grupoDeDestino) {
    try {
        const chats = await client.getChats();
        const grupos = chats.filter(chat => chat.isGroup);

        for (const grupo of grupos) {
            if (grupo.name === grupoDeDestino) continue;

            const euSouAdmin = grupo.participants.some(
                p => p.id._serialized === client.info.wid._serialized && (p.isAdmin || p.isSuperAdmin)
            );
            if (!euSouAdmin) continue;

            const estaNoGrupo = grupo.participants.some(p => p.id._serialized === numeroFormatado);
            if (estaNoGrupo) {
                console.log(`🔄 Removendo do grupo "${grupo.name}"`);
                await grupo.removeParticipants([numeroFormatado]);
                console.log(`✅ Removido`);
            }
        }
        return true;
    } catch (error) {
        return false;
    }
}

app.get('/', (req, res) => {
    res.json({ status: 'OK', whatsappReady });
});

app.get('/status', (req, res) => {
    res.json({ whatsappReady });
});

// ENDPOINT PRINCIPAL COM ETIQUETAS
app.post('/send', async (req, res) => {
    console.log('\n📨 ENDPOINT /SEND');
    
    if (!whatsappReady) {
        return res.status(503).json({ error: 'WhatsApp não pronto' });
    }
    
    const { Nome, Numero, Produto, Status } = req.body;
    
    console.log(`👤 ${Nome} | 📱 ${Numero} | 🎯 ${Produto} | 📊 ${Status}`);
    
    if (!Nome || !Numero || !Produto || !Status) {
        return res.status(400).json({ error: 'Campos faltando' });
    }

    try {
        const numeroFormatado = await formatarNumero(Numero);
        console.log(`✅ Validado: ${numeroFormatado}`);

        const config = configuracaoProdutos[Produto];
        if (!config) {
            return res.status(400).json({ error: 'Produto inválido' });
        }

        if (Status === "Pagamento Aprovado") {
            console.log('\n✅ APROVADO\n');
            
            const mensagem = `**Oi, Seja muito bem-vinda ao ${Produto}! 💛**

Estamos muito felizes em ter você com a gente nessa jornada. 🥰
Agora, quero te explicar os **próximos passos** para que você já comece com tudo:

1️⃣ **Primeiro e mais importante: acesse o e-mail de compra.**

👉 Lá você vai encontrar **os dados de acesso à plataforma, onde estão todas as aulas do Protocolo e os bônus.**
⚠️ Confira se consegue acessar. Caso tenha qualquer dificuldade, é só me chamar aqui neste número de suporte.

2️⃣ **Você será adicionada ao grupo de alunas no WhatsApp e removida do grupo anterior.** Esse é o espaço onde acontecem os avisos e monitorias semanais.

3️⃣ **Responda a sua ficha de matrícula.**
Ela é essencial para que possamos conhecer melhor sua rotina, suas necessidades e te acompanhar de forma mais personalizada. 👇

📝 ${config.link}

**✨ Pronto!** Agora é só começar a assistir às aulas e dar o primeiro passo rumo à transformação que você merece.

Seja muito bem-vinda novamente, estamos juntas nessa! 💛`;

            await client.sendMessage(numeroFormatado, mensagem);
            console.log('✅ Mensagem enviada');
            
            const adicionado = await adicionarAoGrupo(numeroFormatado, config.grupo);
            
            if (adicionado) {
                await removerDeOutrosGrupos(numeroFormatado, config.grupo);
            }

            // ADICIONAR ETIQUETA
            const nomeEtiqueta = `${config.sigla} - Pagamento Aprovado`;
            await adicionarEtiqueta(numeroFormatado, nomeEtiqueta);

            res.json({ 
                success: true,
                message: 'Onboarding enviado',
                tag: nomeEtiqueta
            });

        } else if (Status === "Pagamento Recusado") {
            console.log('\n❌ RECUSADO\n');
            
            const mensagem = `Boa noite ${Nome}! Tudo bem?\nMe chamo Isa, gostaria de te ajudar finalizar seu cadastro no ${Produto}.`;
            
            await client.sendMessage(numeroFormatado, mensagem);
            console.log('✅ Mensagem enviada');

            // ADICIONAR ETIQUETA
            const nomeEtiqueta = `${config.sigla} - Pagamento Recusado`;
            await adicionarEtiqueta(numeroFormatado, nomeEtiqueta);
            
            res.json({ 
                success: true,
                message: 'Mensagem enviada',
                tag: nomeEtiqueta
            });

        } else {
            return res.status(400).json({ error: 'Status inválido' });
        }
        
    } catch (err) {
        console.error('\n❌ ERRO:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/grupos', async (req, res) => {
    if (!whatsappReady) {
        return res.status(503).json({ error: 'WhatsApp não pronto' });
    }
    
    try {
        const chats = await client.getChats();
        const grupos = chats.filter(chat => chat.isGroup).map(g => ({
            nome: g.name,
            participantes: g.participants?.length || 0
        }));
        
        res.json({ grupos, total: grupos.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/test', (req, res) => {
    res.json({ 
        status: 'OK',
        whatsappReady,
        produtos: Object.keys(configuracaoProdutos)
    });
});

console.log('🚀 Inicializando...');
client.initialize();

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor na porta ${PORT}`);
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});