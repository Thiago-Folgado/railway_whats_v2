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

// Health check que responde imediatamente
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        whatsappReady
    });
});

// Endpoint raiz que responde imediatamente
app.get('/', (req, res) => {
    res.json({ 
        status: 'WhatsApp Bot está rodando!',
        whatsappReady,
        timestamp: new Date().toISOString(),
        server: 'OK',
        qrAvailable: !!qrString,
        endpoints: {
            health: '/health',
            status: '/status',
            qrImage: '/qr',
            qrPage: '/qr-page',
            send: '/send',
            grupos: '/grupos',
            test: '/test'
        }
    });
});

// Variáveis globais
let whatsappReady = false;
let currentQRCode = null;
let qrString = '';
let initializationTimeout = null;
let client = null;

// Função para limpar sessão anterior
function clearPreviousSession() {
    console.log('🧹 Limpando sessão anterior...');
    try {
        const sessionPath = path.join(__dirname, '.wwebjs_auth');
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log('✅ Sessão anterior removida');
        }
        
        const qrPath = path.join(__dirname, 'qrcode.png');
        if (fs.existsSync(qrPath)) {
            fs.unlinkSync(qrPath);
            console.log('✅ QR code anterior removido');
        }
    } catch (error) {
        console.log('⚠️ Erro ao limpar sessão:', error.message);
    }
}

// Configuração otimizada do cliente
function initializeWhatsAppClient() {
    console.log('🚀 Inicializando cliente WhatsApp otimizado...');
    
    // Limpar timeout anterior se existir
    if (initializationTimeout) {
        clearTimeout(initializationTimeout);
    }
    
    client = new Client({
        authStrategy: new LocalAuth({ 
            clientId: "whatsapp-session-" + Date.now() // ID único por deploy
        }),
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
                '--disable-renderer-backgrounding',
                '--disable-features=VizDisplayCompositor',
                '--disable-web-security',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--memory-pressure-off',
                '--max-memory-mb=512' // Limitar uso de memória
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
        },
        // Configurações para contas com muitas conversas
        takeoverOnConflict: true,
        takeoverTimeoutMs: 30000,
        authTimeoutMs: 60000,
        restartOnAuthFail: true
    });

    // Timeout de segurança para inicialização
    initializationTimeout = setTimeout(() => {
        console.log('⏰ Timeout de inicialização atingido - reiniciando...');
        if (client && !whatsappReady) {
            client.destroy().then(() => {
                setTimeout(() => {
                    initializeWhatsAppClient();
                }, 5000);
            });
        }
    }, 120000); // 2 minutos
    
    return client;
}

// Configuração dos produtos (mantida igual)
const configuracaoProdutos = {
    "Protocolo Desinflama": {
        link: "https://dramarianasuzuki.com.br/ficha-de-matricula",
        grupo: "Protocolo Desinflama - Alunas"
    },
    "Protocolo O Fim do Lipedema": {
        link: "https://forms.gle/6kcb4EgmZ5RKe8Mo8",
        grupo: "O Fim do Lipedema - Alunas"
    }
};

// Event Handlers otimizados
function setupEventHandlers() {
    // QR Code - com retry automático
    client.on('qr', async (qr) => {
        console.log('\n🔗 QR CODE GERADO!');
        console.log('='.repeat(80));
        
        qrString = qr;
        
        // QR Code no terminal
        console.log('📱 QR Code no terminal:');
        qrcode.generate(qr, { small: true });
        
        // QR Code como string base64
        try {
            const qrImage = await QRCode.toDataURL(qr);
            console.log('\n🖼️ QR CODE BASE64:');
            console.log(qrImage);
        } catch (err) {
            console.error('Erro ao gerar QR base64:', err);
        }
        
        // Salvar QR como imagem
        try {
            const qrPath = path.join(__dirname, 'qrcode.png');
            await QRCode.toFile(qrPath, qr, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            currentQRCode = qrPath;
            console.log(`💾 QR Code salvo em: ${qrPath}`);
        } catch (err) {
            console.error('Erro ao salvar QR:', err);
        }
        
        const deployUrl = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'seu-app.railway.app';
        console.log('\n📋 ACESSE PARA ESCANEAR:');
        console.log(`🌐 https://${deployUrl}/qr-page`);
        console.log('='.repeat(80));
    });

    // WhatsApp pronto
    client.on('ready', () => {
        console.log('\n✅ WHATSAPP CONECTADO E PRONTO!');
        console.log(`📞 Conectado como: ${client.info?.pushname || 'Usuário'}`);
        whatsappReady = true;
        
        // Limpar timeout de inicialização
        if (initializationTimeout) {
            clearTimeout(initializationTimeout);
            initializationTimeout = null;
        }
        
        // Limpar QR code
        currentQRCode = null;
        qrString = '';
        
        const qrPath = path.join(__dirname, 'qrcode.png');
        if (fs.existsSync(qrPath)) {
            try {
                fs.unlinkSync(qrPath);
                console.log('🗑️ QR code removido após conexão');
            } catch (err) {
                console.log('⚠️ Erro ao remover QR:', err);
            }
        }
    });

    // WhatsApp desconectado
    client.on('disconnected', (reason) => {
        console.log('\n❌ WhatsApp desconectado:', reason);
        whatsappReady = false;
        currentQRCode = null;
        qrString = '';
        
        // Auto-restart em caso de desconexão
        console.log('🔄 Tentando reconectar em 10 segundos...');
        setTimeout(() => {
            if (!whatsappReady) {
                clearPreviousSession();
                initializeWhatsAppClient();
                setupEventHandlers();
                client.initialize();
            }
        }, 10000);
    });

    // Eventos de debug
    client.on('auth_failure', (msg) => {
        console.error('\n🚫 FALHA NA AUTENTICAÇÃO:', msg);
        console.log('🧹 Limpando sessão para retry...');
        clearPreviousSession();
    });

    client.on('authenticated', () => {
        console.log('\n🔐 Autenticado com sucesso!');
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`⏳ Carregando: ${percent}% - ${message}`);
        
        // Log especial para contas com muitas conversas
        if (message.includes('Syncing messages') || message.includes('Loading')) {
            console.log('📱 Detectado carregamento de mensagens - pode demorar para contas com muitas conversas');
        }
    });

    // Eventos de erro
    client.on('change_state', state => {
        console.log('🔄 Estado mudou para:', state);
    });
}

// Funções auxiliares (mantidas iguais)
function formatarNumero(numero) {
    let numeroLimpo = numero.replace(/\D/g, '');
    if (!numeroLimpo.startsWith('55')) {
        numeroLimpo = '55' + numeroLimpo;
    }
    return numeroLimpo + '@c.us';
}

async function encontrarGrupo(nomeGrupo) {
    try {
        const chats = await client.getChats();
        return chats.find(chat => chat.isGroup && chat.name === nomeGrupo);
    } catch (error) {
        console.error('Erro ao buscar grupos:', error);
        return null;
    }
}

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
                console.log(`🔄 Removendo ${numeroFormatado} do grupo "${grupo.name}"`);
                await grupo.removeParticipants([numeroFormatado]);
                console.log(`✅ Removido do grupo: ${grupo.name}`);
            }
        }
        return true;
    } catch (error) {
        console.error(`❌ Erro ao remover de outros grupos:`, error);
        return false;
    }
}

// Endpoints (QR Code, Status, etc. - mantidos iguais mas com verificações de segurança)
app.get('/qr', (req, res) => {
    if (currentQRCode && fs.existsSync(currentQRCode)) {
        res.sendFile(path.resolve(currentQRCode));
    } else if (qrString) {
        QRCode.toBuffer(qrString, (err, buffer) => {
            if (err) {
                res.status(500).send('Erro ao gerar QR code');
                return;
            }
            res.type('png');
            res.send(buffer);
        });
    } else {
        res.status(404).send('QR code ainda não foi gerado. Aguarde ou reinicie o bot.');
    }
});

app.get('/qr-page', (req, res) => {
    if (!qrString) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp QR Code</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 20px; 
                        background: #f5f5f5;
                    }
                    .container { 
                        max-width: 500px; 
                        margin: 0 auto; 
                        background: white; 
                        padding: 30px; 
                        border-radius: 10px; 
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    h1 { color: #25D366; }
                    .status { color: #ff6b6b; font-size: 18px; margin: 20px 0; }
                    .refresh { 
                        background: #25D366; 
                        color: white; 
                        border: none; 
                        padding: 10px 20px; 
                        border-radius: 5px; 
                        cursor: pointer; 
                        font-size: 16px;
                        margin: 10px;
                    }
                    .refresh:hover { background: #128C7E; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 WhatsApp Bot</h1>
                    <div class="status">⏳ QR Code ainda não foi gerado...</div>
                    <p>O bot está inicializando. Para contas com muitas conversas, pode demorar alguns minutos.</p>
                    <button class="refresh" onclick="location.reload()">🔄 Atualizar Página</button>
                </div>
                <script>
                    setTimeout(() => location.reload(), 10000);
                </script>
            </body>
            </html>
        `);
    }

    QRCode.toDataURL(qrString, { width: 300, margin: 2 }, (err, url) => {
        if (err) {
            return res.status(500).send('Erro ao gerar QR code');
        }
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp QR Code</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 20px; 
                        background: #f5f5f5;
                    }
                    .container { 
                        max-width: 500px; 
                        margin: 0 auto; 
                        background: white; 
                        padding: 30px; 
                        border-radius: 10px; 
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    h1 { color: #25D366; }
                    .qr-code { 
                        margin: 20px 0; 
                        padding: 20px;
                        background: #f8f9fa;
                        border-radius: 10px;
                        border: 2px dashed #25D366;
                    }
                    .qr-code img { 
                        max-width: 100%; 
                        height: auto; 
                        border-radius: 8px;
                    }
                    .instructions { 
                        text-align: left; 
                        background: #e3f2fd; 
                        padding: 15px; 
                        border-radius: 8px; 
                        margin: 20px 0;
                    }
                    .instructions ol { margin: 0; padding-left: 20px; }
                    .instructions li { margin: 8px 0; }
                    .status { 
                        color: #25D366; 
                        font-weight: bold; 
                        font-size: 18px; 
                        margin: 20px 0; 
                    }
                    .refresh { 
                        background: #25D366; 
                        color: white; 
                        border: none; 
                        padding: 10px 20px; 
                        border-radius: 5px; 
                        cursor: pointer; 
                        font-size: 16px; 
                        margin: 10px;
                    }
                    .refresh:hover { background: #128C7E; }
                    .warning {
                        background: #fff3cd;
                        border: 1px solid #ffeaa7;
                        border-radius: 5px;
                        padding: 10px;
                        margin: 15px 0;
                        color: #856404;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 WhatsApp Bot</h1>
                    <div class="status">✅ QR Code pronto para escaneamento!</div>
                    
                    <div class="warning">
                        ⚠️ <strong>Para contas com muitas conversas:</strong><br>
                        Após escanear, aguarde alguns minutos para o carregamento completo.
                    </div>
                    
                    <div class="qr-code">
                        <img src="${url}" alt="QR Code WhatsApp" />
                    </div>
                    
                    <div class="instructions">
                        <h3>📋 Como escanear:</h3>
                        <ol>
                            <li>Abra o WhatsApp no seu celular</li>
                            <li>Toque no menu (⋮) e selecione "Dispositivos conectados"</li>
                            <li>Toque em "Conectar um dispositivo"</li>
                            <li>Aponte a câmera para o QR code acima</li>
                        </ol>
                    </div>
                    
                    <button class="refresh" onclick="location.reload()">🔄 Atualizar QR Code</button>
                    <button class="refresh" onclick="window.open('/qr', '_blank')">🖼️ Ver apenas a imagem</button>
                </div>
                
                <script>
                    setInterval(async () => {
                        try {
                            const response = await fetch('/status');
                            const data = await response.json();
                            if (data.whatsappReady) {
                                document.querySelector('.status').innerHTML = '🟢 WhatsApp conectado com sucesso!';
                                document.querySelector('.status').style.color = '#4caf50';
                                document.querySelector('.warning').style.display = 'none';
                            }
                        } catch (err) {
                            console.log('Erro ao verificar status:', err);
                        }
                    }, 10000);
                </script>
            </body>
            </html>
        `);
    });
});

app.get('/status', (req, res) => {
    console.log('📊 Endpoint /status chamado');
    res.json({ 
        whatsappReady,
        timestamp: new Date().toISOString(),
        server: 'OK',
        qrAvailable: !!qrString,
        needsQR: !whatsappReady && !qrString,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
});

// Endpoint /send otimizado com validações
app.post('/send', async (req, res) => {
    console.log('📨 Endpoint /send chamado');
    
    if (!whatsappReady) {
        console.log('❌ WhatsApp não está pronto');
        return res.status(503).json({ 
            error: 'WhatsApp não está pronto ainda',
            qrAvailable: !!qrString,
            suggestion: qrString ? 'Acesse /qr-page para escanear o QR code' : 'Aguarde a geração do QR code'
        });
    }
    
    const { Nome, Numero, Produto, Status } = req.body;
    
    if (!Nome || !Numero || !Produto || !Status) {
        console.log('❌ Dados incompletos');
        return res.status(400).json({ 
            error: 'Campos obrigatórios: Nome, Numero, Produto, Status',
            received: { Nome, Numero, Produto, Status }
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
                    error: 'Produto não reconhecido. Produtos válidos: ' + Object.keys(configuracaoProdutos).join(', '),
                    produtosValidos: Object.keys(configuracaoProdutos)
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
                adicionadoAoGrupo,
                timestamp: new Date().toISOString()
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
                produto: Produto,
                timestamp: new Date().toISOString()
            });

        } else {
            console.log('❓ Status desconhecido:', Status);
            return res.status(400).json({ 
                error: `Status não reconhecido: "${Status}". Status válidos: "Pagamento Aprovado" ou "Pagamento Recusado"`,
                statusValidos: ["Pagamento Aprovado", "Pagamento Recusado"]
            });
        }
        
    } catch (err) {
        console.error('❌ Erro ao processar:', err);
        res.status(500).json({ 
            error: 'Erro ao processar solicitação',
            details: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint para listar grupos
app.get('/grupos', async (req, res) => {
    console.log('👥 Endpoint /grupos chamado');
    
    if (!whatsappReady) {
        return res.status(503).json({ 
            error: 'WhatsApp não está pronto ainda',
            qrAvailable: !!qrString
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
            total: grupos.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erro ao listar grupos:', error);
        res.status(500).json({ 
            error: 'Erro ao listar grupos',
            details: error.message 
        });
    }
});

// Endpoint de teste
app.get('/test', (req, res) => {
    console.log('🧪 Endpoint /test chamado');
    res.json({ 
        message: 'Servidor funcionando!',
        timestamp: new Date().toISOString(),
        produtos: Object.keys(configuracaoProdutos),
        qrAvailable: !!qrString,
        whatsappReady,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
});

// Endpoint para forçar limpeza (para debug)
app.post('/clear-session', (req, res) => {
    console.log('🧹 Endpoint /clear-session chamado');
    try {
        if (client) {
            client.destroy();
        }
        clearPreviousSession();
        whatsappReady = false;
        currentQRCode = null;
        qrString = '';
        
        // Reinicializar após limpeza
        setTimeout(() => {
            client = initializeWhatsAppClient();
            setupEventHandlers();
            client.initialize();
        }, 2000);
        
        res.json({ 
            success: true,
            message: 'Sessão limpa e bot reiniciando...',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Erro ao limpar sessão',
            details: error.message 
        });
    }
});

// Inicialização do bot
console.log('🚀 Inicializando WhatsApp Bot otimizado...');
console.log('⚡ Otimizações para contas com muitas conversas ativadas');

// Limpar sessão anterior no início
clearPreviousSession();

// Inicializar cliente
client = initializeWhatsAppClient();
setupEventHandlers();
client.initialize();

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`\n📡 URLs importantes:`);
    
    const deployUrl = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'seu-app.railway.app';
    console.log(`   🏠 Home: https://${deployUrl}/`);
    console.log(`   📱 QR Code: https://${deployUrl}/qr-page`);
    console.log(`   📊 Status: https://${deployUrl}/status`);
    console.log(`   🏥 Health: https://${deployUrl}/health`);
    console.log(`   📨 Send: https://${deployUrl}/send`);
    console.log(`   👥 Grupos: https://${deployUrl}/grupos`);
    console.log(`   🧹 Clear Session: https://${deployUrl}/clear-session (POST)`);
    
    console.log('\n📋 Produtos configurados:');
    Object.entries(configuracaoProdutos).forEach(([produto, config]) => {
        console.log(`   • ${produto} → Grupo: ${config.grupo}`);
    });
    
    console.log('\n⚡ Otimizações ativas:');
    console.log('   • Timeout de inicialização: 2 minutos');
    console.log('   • Auto-restart em desconexão');
    console.log('   • Limpeza automática de sessão');
    console.log('   • Limite de memória: 512MB');
    console.log('   • Health check para Railway');
});

// Graceful shutdown melhorado
process.on('SIGTERM', async () => {
    console.log('🔄 Recebido SIGTERM, encerrando graciosamente...');
    try {
        if (client) {
            await client.destroy();
        }
    } catch (error) {
        console.log('⚠️ Erro ao fechar cliente:', error);
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🔄 Recebido SIGINT, encerrando graciosamente...');
    try {
        if (client) {
            await client.destroy();
        }
    } catch (error) {
        console.log('⚠️ Erro ao fechar cliente:', error);
    }
    process.exit(0);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('🚨 Exceção não capturada:', error);
    // Não fazer exit imediatamente, apenas logar
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Promise rejeitada não tratada:', reason);
    // Não fazer exit imediatamente, apenas logar
});