const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
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

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "whatsapp-session" }),
    puppeteer: {
        headless: true,
        // Configurações otimizadas para Railway/Heroku
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
        // Usar Chromium do sistema se disponível
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    }
});

// Configuração dos produtos
const configuracaoProdutos = {
    "Protocolo Desinflama": {
        link: "https://dramarianasuzuki.com.br/ficha-de-matricula",
        grupo: "Teste Pd"
    },
    "Protocolo O Fim do Lipedema": {
        link: "https://forms.gle/6kcb4EgmZ5RKe8Mo8",
        grupo: "Teste OFL"
    }
};

// QR Code
client.on('qr', (qr) => {
    console.log('\n🔗 ESCANEIE ESTE QR CODE COM SEU WHATSAPP:');
    console.log('='.repeat(50));
    qrcode.generate(qr, { small: true });
    console.log('='.repeat(50));
    console.log('📱 Abra o WhatsApp > Menu > Dispositivos Conectados > Conectar Dispositivo\n');
});

// Endpoint para servir o QR code
app.get('/qr', (req, res) => {
    if (fs.existsSync(qrPath)) {
        res.sendFile(qrPath);
    } else {
        res.status(404).send('QR code ainda não gerado.');
    }
});


// WhatsApp pronto
client.on('ready', () => {
    console.log('\n✅ WHATSAPP CONECTADO E PRONTO!');
    console.log(`📞 Conectado como: ${client.info?.pushname || 'Usuário'}`);
    whatsappReady = true;
});

// WhatsApp desconectado
client.on('disconnected', (reason) => {
    console.log('\n❌ WhatsApp desconectado:', reason);
    whatsappReady = false;
});

// Eventos de debug
client.on('auth_failure', (msg) => {
    console.error('\n🚫 FALHA NA AUTENTICAÇÃO:', msg);
});

client.on('authenticated', () => {
    console.log('\n🔐 Autenticado com sucesso!');
});

client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Carregando WhatsApp: ${percent}% - ${message}`);
});

// Função para formatar número
function formatarNumero(numero) {
    let numeroLimpo = numero.replace(/\D/g, '');
    if (!numeroLimpo.startsWith('55')) {
        numeroLimpo = '55' + numeroLimpo;
    }
    return numeroLimpo + '@c.us';
}

// Função para encontrar grupo por nome
async function encontrarGrupo(nomeGrupo) {
    try {
        const chats = await client.getChats();
        return chats.find(chat => chat.isGroup && chat.name === nomeGrupo);
    } catch (error) {
        console.error('Erro ao buscar grupos:', error);
        return null;
    }
}

// Função para adicionar ao grupo
async function adicionarAoGrupo(numeroFormatado, nomeGrupo) {
    try {
        const grupo = await encontrarGrupo(nomeGrupo);
        if (!grupo) {
            console.log(`❌ Grupo "${nomeGrupo}" não encontrado`);
            return false;
        }

        await grupo.addParticipants([numeroFormatado]);
        console.log(`✅ Contato adicionado ao grupo: ${nomeGrupo}`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao adicionar ao grupo "${nomeGrupo}":`, error);
        if (error?.data) {
            console.error('📄 Detalhes do erro:', JSON.stringify(error.data, null, 2));
        }
        return false;
    }
}

// Função para remover de outros grupos onde sou admin
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
                console.log(`🔄 Removendo ${numeroFormatado} do grupo "${grupo.name}"`);
                await grupo.removeParticipants([numeroFormatado]);
                console.log(`✅ Removido do grupo: ${grupo.name}`);
            }
        }
        return true;
    } catch (error) {
        console.error(`❌ Erro ao remover ${numeroFormatado} de outros grupos:`, error);
        return false;
    }
}

// Endpoint de status
app.get('/', (req, res) => {
    res.json({ 
        status: 'WhatsApp Bot está rodando!',
        whatsappReady,
        timestamp: new Date().toISOString(),
        server: 'OK'
    });
});

app.get('/status', (req, res) => {
    console.log('📊 Endpoint /status chamado');
    res.json({ 
        whatsappReady,
        timestamp: new Date().toISOString(),
        server: 'OK'
    });
});

// Endpoint para processar envio
app.post('/send', async (req, res) => {
    console.log('📨 Endpoint /send chamado');
    
    if (!whatsappReady) {
        console.log('❌ WhatsApp não está pronto');
        return res.status(503).json({ 
            error: 'WhatsApp não está pronto ainda' 
        });
    }
    
    const { Nome, Numero, Produto, Status } = req.body;
    
    if (!Nome || !Numero || !Produto || !Status) {
        console.log('❌ Dados incompletos');
        return res.status(400).json({ 
            error: 'Campos obrigatórios: Nome, Numero, Produto, Status' 
        });
    }

    const numeroFormatado = formatarNumero(Numero);
    console.log(`\n🔄 Processando para: ${Nome} (${Numero})`);
    console.log(`🎯 Produto: ${Produto}`);
    console.log(`📊 Status: ${Status}`);

    try {
        if (Status === "Pagamento Aprovado") {
            console.log('✅ Status: APROVADO - Enviando onboarding');
            
            const config = configuracaoProdutos[Produto];
            if (!config) {
                console.log('❌ Produto não reconhecido:', Produto);
                return res.status(400).json({ 
                    error: 'Produto não reconhecido. Produtos válidos: ' + Object.keys(configuracaoProdutos).join(', ')
                });
            }
            
            const mensagemOnboarding = `**Oi, Seja muito bem-vinda ao ${Produto}! 💛**

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

            console.log(`📱 Enviando mensagem de onboarding para: ${numeroFormatado}`);
            await client.sendMessage(numeroFormatado, mensagemOnboarding);
            console.log(`✅ Mensagem de onboarding enviada para ${Nome}`);
            
            const adicionadoAoGrupo = await adicionarAoGrupo(numeroFormatado, config.grupo);

            if (adicionadoAoGrupo) {
                await removerDeOutrosGrupos(numeroFormatado, config.grupo);
            }

            res.status(200).json({ 
                success: true,
                message: 'Onboarding enviado com sucesso',
                status: 'Pagamento Aprovado',
                numeroFormatado,
                produto: Produto,
                link: config.link,
                grupo: config.grupo,
                adicionadoAoGrupo
            });

        } else if (Status === "Pagamento Recusado") {
            console.log('❌ Status: RECUSADO - Enviando notificação de reprovação');
            
            const mensagemReprovacao = `Boa noite ${Nome}! Tudo bem?\nMe chamo Isa, gostaria de te ajudar finalizar seu cadastro no ${Produto}.`;
            
            console.log(`📱 Enviando mensagem de reprovação para: ${numeroFormatado}`);
            await client.sendMessage(numeroFormatado, mensagemReprovacao);
            console.log(`✅ Mensagem de reprovação enviada para ${Nome}`);
            
            res.status(200).json({ 
                success: true,
                message: 'Mensagem de reprovação enviada com sucesso',
                status: 'Pagamento Recusado',
                numeroFormatado,
                produto: Produto
            });

        } else {
            console.log('❓ Status desconhecido:', Status);
            return res.status(400).json({ 
                error: `Status não reconhecido: "${Status}". Status válidos: "Pagamento Aprovado" ou "Pagamento Recusado"` 
            });
        }
        
    } catch (err) {
        console.error('❌ Erro ao processar:', err);
        res.status(500).json({ 
            error: 'Erro ao processar solicitação',
            details: err.message 
        });
    }
});

// Endpoint para listar grupos
app.get('/grupos', async (req, res) => {
    console.log('👥 Endpoint /grupos chamado');
    
    if (!whatsappReady) {
        return res.status(503).json({ 
            error: 'WhatsApp não está pronto ainda' 
        });
    }
    
    try {
        const chats = await client.getChats();
        const grupos = chats.filter(chat => chat.isGroup).map(grupo => ({
            id: grupo.id._serialized,
            nome: grupo.name,
            participantes: grupo.participants?.length || 0
        }));
        
        res.json({ 
            grupos,
            total: grupos.length
        });
        
    } catch (error) {
        console.error('❌ Erro ao listar grupos:', error);
        res.status(500).json({ 
            error: 'Erro ao listar grupos',
            details: error.message 
        });
    }
});

// Endpoint de teste simples
app.get('/test', (req, res) => {
    console.log('🧪 Endpoint /test chamado');
    res.json({ 
        message: 'Servidor funcionando!',
        timestamp: new Date().toISOString(),
        produtos: Object.keys(configuracaoProdutos)
    });
});

// Inicializar cliente
console.log('Inicializando WhatsApp...');
client.initialize();

// Porta dinâmica para Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📊 Status: http://localhost:${PORT}/status`);
    console.log(`🧪 Teste: http://localhost:${PORT}/test`);
    console.log(`📨 Send: http://localhost:${PORT}/send`);
    console.log(`👥 Grupos: http://localhost:${PORT}/grupos`);
    console.log('\n📋 Produtos configurados:');
    Object.entries(configuracaoProdutos).forEach(([produto, config]) => {
        console.log(`   • ${produto} → Grupo: ${config.grupo}`);
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 Recebido SIGTERM, encerrando graciosamente...');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🔄 Recebido SIGINT, encerrando graciosamente...');
    client.destroy();
    process.exit(0);
});