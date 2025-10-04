const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());

// Middleware para logs detalhados
app.use((req, res, next) => {
    console.log(`\n=== REQUISIÇÃO RECEBIDA ===`);
    console.log(`Método: ${req.method}`);
    console.log(`URL: ${req.url}`);
    console.log(`IP: ${req.ip}`);
    console.log(`User-Agent: ${req.get('User-Agent')}`);
    console.log(`Headers:`, req.headers);
    console.log(`Body:`, req.body);
    console.log('============================\n');
    next();
});

// Variável para controlar se o WhatsApp está pronto
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
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    }
});

// Configuração dos produtos
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

// QR Code
client.on('qr', async (qr) => {
    console.log('\n🔗 QR CODE GERADO!');
    qrString = qr;
    qrcode.generate(qr, { small: true });
    
    try {
        const qrPath = path.join(__dirname, 'qrcode.png');
        await QRCode.toFile(qrPath, qr, { width: 300, margin: 2 });
        currentQRCode = qrPath;
        console.log(`💾 QR Code salvo: ${qrPath}`);
    } catch (err) {
        console.error('Erro ao salvar QR:', err);
    }
});

// Endpoints QR
app.get('/qr', (req, res) => {
    if (currentQRCode && fs.existsSync(currentQRCode)) {
        res.sendFile(path.resolve(currentQRCode));
    } else if (qrString) {
        QRCode.toBuffer(qrString, (err, buffer) => {
            if (err) return res.status(500).send('Erro ao gerar QR code');
            res.type('png').send(buffer);
        });
    } else {
        res.status(404).send('QR code não gerado');
    }
});

app.get('/qr-page', (req, res) => {
    if (!qrString) {
        return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WhatsApp QR</title></head><body style="text-align:center;padding:50px;font-family:Arial"><h1>⏳ Aguardando QR Code...</h1><p>Atualizando em 5s...</p><script>setTimeout(() => location.reload(), 5000);</script></body></html>`);
    }

    QRCode.toDataURL(qrString, { width: 300 }, (err, url) => {
        if (err) return res.status(500).send('Erro');
        res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WhatsApp QR</title></head><body style="text-align:center;padding:50px;font-family:Arial"><h1>📱 WhatsApp QR Code</h1><img src="${url}" style="border:2px solid #25D366;padding:20px;border-radius:10px"><p><b>Escaneie com WhatsApp Business</b></p></body></html>`);
    });
});

// WhatsApp eventos
client.on('ready', () => {
    console.log('✅ WHATSAPP CONECTADO!');
    whatsappReady = true;
    currentQRCode = null;
    qrString = '';
});

client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp desconectado:', reason);
    whatsappReady = false;
});

client.on('auth_failure', (msg) => {
    console.error('🚫 FALHA NA AUTENTICAÇÃO:', msg);
});

client.on('authenticated', () => {
    console.log('🔐 Autenticado!');
});

client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Carregando: ${percent}% - ${message}`);
});

// Verificar número no WhatsApp
async function verificarNumeroWhatsApp(numero) {
    console.log(`\n🔍 Verificando número: ${numero}`);
    
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
            console.log(`❌ Não encontrado com 8 dígitos`);
        }
        
        console.log(`🔄 Tentando 9 dígitos: ${numeroBase}`);
        try {
            const resultado9 = await client.getNumberId(numeroBase);
            if (resultado9) {
                console.log(`✅ Encontrado com 9 dígitos!`);
                return numeroBase + '@c.us';
            }
        } catch (err) {
            console.log(`❌ Não encontrado com 9 dígitos`);
        }
    }
    
    if (numeroBase.length === 12) {
        console.log(`🔄 Tentando formato padrão: ${numeroBase}`);
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
    
    console.log(`❌ Número não encontrado no WhatsApp\n`);
    return null;
}

async function formatarNumero(numero) {
    const numeroValido = await verificarNumeroWhatsApp(numero);
    if (!numeroValido) {
        throw new Error(`Número não encontrado no WhatsApp: ${numero}`);
    }
    return numeroValido;
}

// Adicionar etiqueta
async function adicionarEtiqueta(numeroFormatado, nomeEtiqueta) {
    try {
        console.log(`\n🏷️  Adicionando etiqueta: "${nomeEtiqueta}"`);
        
        const chat = await client.getChatById(numeroFormatado);
        console.log(`✅ Chat encontrado`);
        
        if (typeof chat.addLabel !== 'function') {
            console.log(`⚠️  Método addLabel não disponível`);
            console.log(`💡 Execute: npm install whatsapp-web.js@latest`);
            return false;
        }
        
        const labels = await client.getLabels();
        console.log(`📋 Etiquetas disponíveis: ${labels.length}`);
        
        if (labels.length > 0) {
            labels.forEach(l => console.log(`   • ${l.name}`));
        }
        
        const etiqueta = labels.find(l => l.name === nomeEtiqueta);
        
        if (!etiqueta) {
            console.log(`\n⚠️  Etiqueta "${nomeEtiqueta}" não existe!`);
            console.log(`💡 Crie no WhatsApp Business:`);
            console.log(`   Configurações > Ferramentas comerciais > Etiquetas`);
            return false;
        }
        
        console.log(`✅ Etiqueta encontrada: "${etiqueta.name}"`);
        await chat.addLabel(etiqueta.id);
        console.log(`✅ Etiqueta adicionada com sucesso!\n`);
        return true;
        
    } catch (error) {
        console.error(`❌ Erro ao adicionar etiqueta: ${error.message}\n`);
        return false;
    }
}

// Encontrar grupo
async function encontrarGrupo(nomeGrupo) {
    try {
        const chats = await client.getChats();
        return chats.find(chat => chat.isGroup && chat.name === nomeGrupo);
    } catch (error) {
        console.error('Erro ao buscar grupos:', error);
        return null;
    }
}

// Adicionar ao grupo
async function adicionarAoGrupo(numeroFormatado, nomeGrupo) {
    try {
        const grupo = await encontrarGrupo(nomeGrupo);
        if (!grupo) {
            console.log(`❌ Grupo "${nomeGrupo}" não encontrado`);
            return false;
        }
        await grupo.addParticipants([numeroFormatado]);
        console.log(`✅ Adicionado ao grupo: ${nomeGrupo}`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao adicionar ao grupo:`, error);
        return false;
    }
}

// Remover de outros grupos
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
        console.error(`❌ Erro ao remover de grupos:`, error);
        return false;
    }
}

// Endpoints
app.get('/', (req, res) => {
    res.json({ 
        status: 'WhatsApp Bot rodando',
        whatsappReady,
        timestamp: new Date().toISOString()
    });
});

app.get('/status', (req, res) => {
    res.json({ 
        whatsappReady,
        timestamp: new Date().toISOString()
    });
});

// Endpoint principal
app.post('/send', async (req, res) => {
    const startTime = Date.now();
    console.log('\n' + '='.repeat(50));
    console.log('📨 ENDPOINT /SEND CHAMADO');
    console.log('='.repeat(50));
    
    if (!whatsappReady) {
        return res.status(503).json({ error: 'WhatsApp não está pronto' });
    }
    
    const { Nome, Numero, Produto, Status } = req.body;
    
    console.log(`👤 Nome: ${Nome}`);
    console.log(`📱 Numero: ${Numero}`);
    console.log(`🎯 Produto: ${Produto}`);
    console.log(`📊 Status: ${Status}`);
    
    if (!Nome || !Numero || !Produto || !Status) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    try {
        const numeroFormatado = await formatarNumero(Numero);
        console.log(`✅ Número validado: ${numeroFormatado}`);

        const config = configuracaoProdutos[Produto];
        if (!config) {
            return res.status(400).json({ error: 'Produto não reconhecido' });
        }

        if (Status === "Pagamento Aprovado") {
            console.log('\n✅ PAGAMENTO APROVADO\n');
            
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

            console.log('📤 Enviando mensagem...');
            await client.sendMessage(numeroFormatado, mensagem);
            console.log('✅ Mensagem enviada!');
            
            console.log('👥 Adicionando ao grupo...');
            const adicionado = await adicionarAoGrupo(numeroFormatado, config.grupo);
            
            if (adicionado) {
                console.log('🔄 Removendo de outros grupos...');
                await removerDeOutrosGrupos(numeroFormatado, config.grupo);
            }

            const nomeEtiqueta = `${config.sigla} - Pagamento Aprovado`;
            await adicionarEtiqueta(numeroFormatado, nomeEtiqueta);

            const totalTime = Date.now() - startTime;
            console.log(`\n🎉 CONCLUÍDO em ${totalTime}ms\n`);

            res.json({ 
                success: true,
                message: 'Onboarding enviado',
                numeroFormatado,
                produto: Produto,
                tag: nomeEtiqueta
            });

        } else if (Status === "Pagamento Recusado") {
            console.log('\n❌ PAGAMENTO RECUSADO\n');
            
            const mensagem = `Boa noite ${Nome}! Tudo bem?\nMe chamo Isa, gostaria de te ajudar finalizar seu cadastro no ${Produto}.`;
            
            console.log('📤 Enviando mensagem...');
            await client.sendMessage(numeroFormatado, mensagem);
            console.log('✅ Mensagem enviada!');

            const nomeEtiqueta = `${config.sigla} - Pagamento Recusado`;
            await adicionarEtiqueta(numeroFormatado, nomeEtiqueta);

            const totalTime = Date.now() - startTime;
            console.log(`\n🎉 CONCLUÍDO em ${totalTime}ms\n`);
            
            res.json({ 
                success: true,
                message: 'Mensagem de reprovação enviada',
                numeroFormatado,
                produto: Produto,
                tag: nomeEtiqueta
            });

        } else {
            return res.status(400).json({ error: 'Status inválido' });
        }
        
    } catch (err) {
        console.error('\n❌ ERRO:', err.message);
        res.status(500).json({ 
            error: 'Erro ao processar',
            details: err.message 
        });
    }
});

// Listar grupos
app.get('/grupos', async (req, res) => {
    if (!whatsappReady) {
        return res.status(503).json({ error: 'WhatsApp não está pronto' });
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
        message: 'Servidor OK',
        whatsappReady,
        produtos: Object.keys(configuracaoProdutos)
    });
});

// Inicializar
console.log('🚀 Inicializando WhatsApp...');
client.initialize();

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 QR Code: /qr-page`);
    console.log(`📊 Status: /status`);
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('🚨 EXCEÇÃO:', error.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('🚨 PROMISE REJEITADA:', reason);
});

process.on('SIGINT', () => {
    console.log('🔄 Encerrando...');
    client.destroy();
    process.exit(0);
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});