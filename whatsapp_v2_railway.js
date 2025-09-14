const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode'); // Adicione essa dependência
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
        grupo: "Teste Pd"
    },
    "Protocolo O Fim do Lipedema": {
        link: "https://forms.gle/6kcb4EgmZ5RKe8Mo8",
        grupo: "Teste OFL"
    }
};

// QR Code - Múltiplas opções de visualização
client.on('qr', async (qr) => {
    console.log('\n🔗 QR CODE GERADO!');
    console.log('='.repeat(80));
    
    // Salvar o QR code string
    qrString = qr;
    
    // 1. QR Code no terminal (pode não funcionar bem no Railway)
    console.log('📱 QR Code no terminal:');
    qrcode.generate(qr, { small: true });
    
    // 2. QR Code como string base64 nos logs
    try {
        const qrImage = await QRCode.toDataURL(qr);
        console.log('\n🖼️ QR CODE BASE64 (copie e cole em um visualizador online):');
        console.log(qrImage);
    } catch (err) {
        console.error('Erro ao gerar QR base64:', err);
    }
    
    // 3. QR Code ASCII nos logs (mais legível)
    try {
        const qrAscii = await QRCode.toString(qr, { type: 'terminal', width: 60 });
        console.log('\n📟 QR CODE ASCII:');
        console.log(qrAscii);
    } catch (err) {
        console.error('Erro ao gerar QR ASCII:', err);
    }
    
    // 4. Salvar QR como imagem PNG
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
        console.log(`\n💾 QR Code salvo como imagem em: ${qrPath}`);
    } catch (err) {
        console.error('Erro ao salvar QR como imagem:', err);
    }
    
    console.log('\n📋 OPÇÕES PARA ESCANEAR:');
    console.log('1. Acesse: https://seu-app.railway.app/qr para ver o QR code');
    console.log('2. Acesse: https://seu-app.railway.app/qr-page para uma página completa');
    console.log('3. Use um decodificador online para o base64 acima');
    console.log('4. Use o QR ASCII acima se estiver legível');
    console.log('='.repeat(80));
    console.log('📱 WhatsApp > Menu > Dispositivos Conectados > Conectar Dispositivo\n');
});

// Endpoint para servir o QR code como imagem
app.get('/qr', (req, res) => {
    if (currentQRCode && fs.existsSync(currentQRCode)) {
        res.sendFile(path.resolve(currentQRCode));
    } else if (qrString) {
        // Se não tiver arquivo, gerar QR code dinamicamente
        QRCode.toBuffer(qrString, (err, buffer) => {
            if (err) {
                res.status(500).send('Erro ao gerar QR code');
                return;
            }
            res.type('png');
            res.send(buffer);
        });
    } else {
        res.status(404).send('QR code ainda não foi gerado. Reinicie o bot se necessário.');
    }
});

// Endpoint para uma página HTML com o QR code
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
                    }
                    .refresh:hover { background: #128C7E; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 WhatsApp Bot</h1>
                    <div class="status">⏳ QR Code ainda não foi gerado...</div>
                    <p>O bot está inicializando. Aguarde alguns segundos e atualize a página.</p>
                    <button class="refresh" onclick="location.reload()">🔄 Atualizar Página</button>
                </div>
                <script>
                    // Auto-refresh a cada 5 segundos até o QR aparecer
                    setTimeout(() => location.reload(), 5000);
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
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 WhatsApp Bot</h1>
                    <div class="status">✅ QR Code pronto para escaneamento!</div>
                    
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
                    // Verificar status a cada 10 segundos
                    setInterval(async () => {
                        try {
                            const response = await fetch('/status');
                            const data = await response.json();
                            if (data.whatsappReady) {
                                document.querySelector('.status').innerHTML = '🟢 WhatsApp conectado com sucesso!';
                                document.querySelector('.status').style.color = '#4caf50';
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

// WhatsApp pronto
client.on('ready', () => {
    console.log('\n✅ WHATSAPP CONECTADO E PRONTO!');
    console.log(`📞 Conectado como: ${client.info?.pushname || 'Usuário'}`);
    whatsappReady = true;
    
    // Limpar o QR code quando conectar
    currentQRCode = null;
    qrString = '';
    
    // Tentar deletar o arquivo QR se existir
    const qrPath = path.join(__dirname, 'qrcode.png');
    if (fs.existsSync(qrPath)) {
        try {
            fs.unlinkSync(qrPath);
            console.log('🗑️ Arquivo QR code removido após conexão');
        } catch (err) {
            console.log('⚠️ Não foi possível remover o arquivo QR:', err);
        }
    }
});

// WhatsApp desconectado
client.on('disconnected', (reason) => {
    console.log('\n❌ WhatsApp desconectado:', reason);
    whatsappReady = false;
    currentQRCode = null;
    qrString = '';
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
        server: 'OK',
        qrAvailable: !!qrString,
        endpoints: {
            status: '/status',
            qrImage: '/qr',
            qrPage: '/qr-page',
            send: '/send',
            grupos: '/grupos',
            test: '/test'
        }
    });
});

app.get('/status', (req, res) => {
    console.log('📊 Endpoint /status chamado');
    res.json({ 
        whatsappReady,
        timestamp: new Date().toISOString(),
        server: 'OK',
        qrAvailable: !!qrString,
        needsQR: !whatsappReady && !qrString
    });
});

// [Resto do código permanece igual - endpoints /send, /grupos, /test, etc.]

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
        produtos: Object.keys(configuracaoProdutos),
        qrAvailable: !!qrString,
        whatsappReady
    });
});

// Inicializar cliente
console.log('🚀 Inicializando WhatsApp...');
console.log('📋 Depois que o bot inicializar, acesse:');
console.log(`   🖼️  /qr-page - Página completa com QR code`);
console.log(`   📱  /qr - Apenas a imagem do QR code`);
console.log(`   📊  /status - Status do bot`);
client.initialize();

// Porta dinâmica para Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`\n📡 URLs importantes:`);
    console.log(`   🏠 Home: https://seu-app.railway.app/`);
    console.log(`   📱 QR Code: https://seu-app.railway.app/qr-page`);
    console.log(`   📊 Status: https://seu-app.railway.app/status`);
    console.log(`   📨 Send: https://seu-app.railway.app/send`);
    console.log(`   👥 Grupos: https://seu-app.railway.app/grupos`);
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

// Adicione este endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});