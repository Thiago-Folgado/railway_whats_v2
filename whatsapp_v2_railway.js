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

// QR Code - Múltiplas opções de visualização
client.on('qr', async (qr) => {
    console.log('\n🔗 QR CODE GERADO!');
    console.log('='.repeat(80));
    
    qrString = qr;
    
    console.log('📱 QR Code no terminal:');
    qrcode.generate(qr, { small: true });
    
    try {
        const qrImage = await QRCode.toDataURL(qr);
        console.log('\n🖼️ QR CODE BASE64 (copie e cole em um visualizador online):');
        console.log(qrImage);
    } catch (err) {
        console.error('Erro ao gerar QR base64:', err);
    }
    
    try {
        const qrAscii = await QRCode.toString(qr, { type: 'terminal', width: 60 });
        console.log('\n📟 QR CODE ASCII:');
        console.log(qrAscii);
    } catch (err) {
        console.error('Erro ao gerar QR ASCII:', err);
    }
    
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
    console.log('\n' + '🎉'.repeat(20));
    console.log('✅ WHATSAPP CONECTADO E PRONTO!');
    console.log(`📞 Conectado como: ${client.info?.pushname || 'Usuário'}`);
    console.log(`📱 Número: ${client.info?.wid?.user || 'N/A'}`);
    console.log(`🆔 ID: ${client.info?.wid?._serialized || 'N/A'}`);
    console.log(`⏰ Conectado em: ${new Date().toISOString()}`);
    console.log('🎉'.repeat(20) + '\n');
    
    whatsappReady = true;
    currentQRCode = null;
    qrString = '';
    
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
    console.log('\n' + '❌'.repeat(20));
    console.log('❌ WhatsApp desconectado:', reason);
    console.log(`⏰ Desconectado em: ${new Date().toISOString()}`);
    console.log('❌'.repeat(20) + '\n');
    whatsappReady = false;
    currentQRCode = null;
    qrString = '';
});

// Eventos de debug
client.on('auth_failure', (msg) => {
    console.error('\n' + '🚫'.repeat(20));
    console.error('🚫 FALHA NA AUTENTICAÇÃO:', msg);
    console.error(`⏰ Erro em: ${new Date().toISOString()}`);
    console.error('🚫'.repeat(20) + '\n');
});

client.on('authenticated', () => {
    console.log('\n' + '🔐'.repeat(15));
    console.log('🔐 Autenticado com sucesso!');
    console.log(`⏰ Autenticado em: ${new Date().toISOString()}`);
    console.log('🔐'.repeat(15) + '\n');
});

client.on('loading_screen', (percent, message) => {
    console.log(`⏳ [${new Date().toISOString()}] Carregando WhatsApp: ${percent}% - ${message}`);
    
    if (message.includes('Syncing messages') || message.includes('messages')) {
        console.log('📱💬 DETECTADO: Sincronização de mensagens - pode demorar para contas com muitas conversas');
    }
    if (message.includes('Syncing chats') || message.includes('chats')) {
        console.log('📱💬 DETECTADO: Sincronização de chats - pode demorar para contas com muitas conversas');
    }
    if (message.includes('Loading') && percent < 50) {
        console.log('📱⚠️ AVISO: Carregamento inicial pode demorar vários minutos para contas com histórico extenso');
    }
    if (percent > 80) {
        console.log('📱🚀 Quase pronto! Finalizando sincronização...');
    }
});

client.on('change_state', state => {
    console.log(`🔄 [${new Date().toISOString()}] Estado mudou para: ${state}`);
    
    if (state === 'OPENING') {
        console.log('📱🔓 WhatsApp iniciando...');
    }
    if (state === 'PAIRING') {
        console.log('📱🔗 Pareando dispositivo...');
    }
    if (state === 'UNPAIRED') {
        console.log('📱❌ Dispositivo não pareado');
    }
    if (state === 'TIMEOUT') {
        console.log('📱⏰ TIMEOUT detectado - possível problema com contas que têm muitas conversas');
    }
});

client.on('change_battery', (batteryInfo) => {
    console.log(`🔋 [${new Date().toISOString()}] Bateria do celular: ${batteryInfo.battery}% (${batteryInfo.plugged ? 'Carregando' : 'Descarregando'})`);
});

// ============================================
// FUNÇÃO: Verificar número no WhatsApp
// ============================================
async function verificarNumeroWhatsApp(numero) {
    console.log(`\n🔍 === VERIFICAÇÃO DE NÚMERO ===`);
    console.log(`📱 Número recebido: ${numero}`);
    
    const numeroLimpo = numero.replace(/\D/g, '');
    console.log(`🧹 Número limpo: ${numeroLimpo}`);
    
    let numeroBase = numeroLimpo.startsWith('55') ? numeroLimpo : '55' + numeroLimpo;
    console.log(`🇧🇷 Número com código do país: ${numeroBase}`);
    console.log(`📏 Tamanho: ${numeroBase.length} dígitos`);
    
    if (numeroBase.length === 13) {
        const ddd = numeroBase.substring(2, 4);
        const numeroSemDDD = numeroBase.substring(4);
        
        console.log(`📍 DDD: ${ddd}`);
        console.log(`📞 Número sem DDD: ${numeroSemDDD} (${numeroSemDDD.length} dígitos)`);
        
        const formato8Digitos = '55' + ddd + numeroSemDDD.substring(1);
        console.log(`\n🔄 Tentativa 1: Formato 8 dígitos (12 total)`);
        console.log(`   Número: ${formato8Digitos}`);
        
        try {
            const resultado8 = await client.getNumberId(formato8Digitos);
            if (resultado8) {
                console.log(`   ✅ ENCONTRADO! Número registrado com 8 dígitos`);
                console.log(`   📱 ID WhatsApp: ${resultado8._serialized}`);
                console.log(`=================================\n`);
                return formato8Digitos + '@c.us';
            }
        } catch (err) {
            console.log(`   ❌ Não encontrado com 8 dígitos`);
        }
        
        console.log(`\n🔄 Tentativa 2: Formato 9 dígitos (13 total)`);
        console.log(`   Número: ${numeroBase}`);
        
        try {
            const resultado9 = await client.getNumberId(numeroBase);
            if (resultado9) {
                console.log(`   ✅ ENCONTRADO! Número registrado com 9 dígitos`);
                console.log(`   📱 ID WhatsApp: ${resultado9._serialized}`);
                console.log(`=================================\n`);
                return numeroBase + '@c.us';
            }
        } catch (err) {
            console.log(`   ❌ Não encontrado com 9 dígitos`);
        }
    }
    
    if (numeroBase.length === 12) {
        console.log(`\n🔄 Tentativa: Formato padrão (12 dígitos)`);
        console.log(`   Número: ${numeroBase}`);
        
        try {
            const resultado = await client.getNumberId(numeroBase);
            if (resultado) {
                console.log(`   ✅ ENCONTRADO!`);
                console.log(`   📱 ID WhatsApp: ${resultado._serialized}`);
                console.log(`=================================\n`);
                return numeroBase + '@c.us';
            }
        } catch (err) {
            console.log(`   ❌ Número não encontrado`);
        }
    }
    
    console.log(`\n❌ NÚMERO NÃO ENCONTRADO EM NENHUM FORMATO`);
    console.log(`=================================\n`);
    return null;
}

// ============================================
// FUNÇÃO: Formatar número
// ============================================
async function formatarNumero(numero) {
    console.log(`🔍 Iniciando verificação do número: ${numero}`);
    
    const numeroValido = await verificarNumeroWhatsApp(numero);
    
    if (!numeroValido) {
        throw new Error(`❌ Número não encontrado no WhatsApp: ${numero}`);
    }
    
    console.log(`✅ Número validado e formatado: ${numeroValido}`);
    return numeroValido;
}

// ============================================
// FUNÇÃO: Adicionar etiqueta ao contato
// ============================================
async function adicionarEtiqueta(numeroFormatado, nomeEtiqueta) {
    try {
        console.log(`\n🏷️  === ADICIONANDO ETIQUETA ===`);
        console.log(`📱 Número: ${numeroFormatado}`);
        console.log(`🏷️  Etiqueta desejada: "${nomeEtiqueta}"`);
        
        const chat = await client.getChatById(numeroFormatado);
        console.log(`✅ Chat encontrado: ${chat.name || numeroFormatado}`);
        
        if (typeof chat.addLabel !== 'function') {
            console.log(`⚠️  AVISO: Método addLabel não disponível nesta versão do whatsapp-web.js`);
            console.log(`💡 SOLUÇÃO: Atualize o whatsapp-web.js:`);
            console.log(`   npm install whatsapp-web.js@latest`);
            console.log(`=================================\n`);
            return false;
        }
        
        const labels = await client.getLabels();
        console.log(`📋 Total de etiquetas disponíveis: ${labels.length}`);
        
        if (labels.length > 0) {
            console.log(`📋 Etiquetas existentes:`);
            labels.forEach(l => console.log(`   • ${l.name} (ID: ${l.id})`));
        }
        
        const etiqueta = labels.find(l => l.name === nomeEtiqueta);
        
        if (!etiqueta) {
            console.log(`\n⚠️  Etiqueta "${nomeEtiqueta}" não existe.`);
            console.log(`💡 IMPORTANTE: Crie esta etiqueta manualmente no WhatsApp Business:`);
            console.log(`   1. Abra WhatsApp Business no celular`);
            console.log(`   2. Configurações > Ferramentas comerciais > Etiquetas`);
            console.log(`   3. Crie a etiqueta: "${nomeEtiqueta}"`);
            console.log(`=================================\n`);
            return false;
        }
        
        console.log(`✅ Etiqueta encontrada: "${etiqueta.name}" (ID: ${etiqueta.id})`);
        
        await chat.addLabel(etiqueta.id);
        console.log(`✅ Etiqueta "${nomeEtiqueta}" adicionada com sucesso!`);
        console.log(`=================================\n`);
        return true;
        
    } catch (error) {
        console.error(`\n❌ ERRO ao adicionar etiqueta "${nomeEtiqueta}":`);
        console.error(`   Mensagem: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        console.error(`=================================\n`);
        return false;
    }
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

// Função para remover de outros grupos
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

// ============================================
// ENDPOINT /SEND
// ============================================
app.post('/send', async (req, res) => {
    const startTime = Date.now();
    console.log('\n' + '📨'.repeat(30));
    console.log('📨 ENDPOINT /SEND CHAMADO');
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log('📨'.repeat(30));
    
    if (!whatsappReady) {
        console.log('❌ ERRO: WhatsApp não está pronto');
        return res.status(503).json({ 
            error: 'WhatsApp não está pronto ainda' 
        });
    }
    
    const { Nome, Numero, Produto, Status } = req.body;
    
    console.log('📋 DADOS RECEBIDOS:');
    console.log(`   👤 Nome: ${Nome || 'NÃO INFORMADO'}`);
    console.log(`   📱 Numero: ${Numero || 'NÃO INFORMADO'}`);
    console.log(`   🎯 Produto: ${Produto || 'NÃO INFORMADO'}`);
    console.log(`   📊 Status: ${Status || 'NÃO INFORMADO'}`);
    
    if (!Nome || !Numero || !Produto || !Status) {
        console.log('❌ ERRO: Dados incompletos');
        return res.status(400).json({ 
            error: 'Campos obrigatórios: Nome, Numero, Produto, Status' 
        });
    }

    try {
        console.log(`\n🔄 Validando e formatando número...`);
        const numeroFormatado = await formatarNumero(Numero);
        console.log(`✅ Número formatado: ${numeroFormatado}`);

        if (Status === "Pagamento Aprovado") {
            console.log('\n✅ STATUS: PAGAMENTO APROVADO');
            
            const config = configuracaoProdutos[Produto];
            if (!config) {
                console.log('❌ ERRO: Produto não reconhecido:', Produto);
                return res.status(400).json({ 
                    error: 'Produto não reconhecido' 
                });
            }
            
            const mensagemOnboarding = `**Oi, Seja muito bem-vinda ao ${Produto}! 💛**

Estamos muito felizes em ter você com a gente nessa jornada. 🥰
Agora, quero te explicar os **próximos passos** para que você já comece com tudo:

1️⃣ **Primeiro e mais importante: acesse o e-mail de compra.**

👉 Lá você vai encontrar **os dados de acesso à plataforma, onde estão todas as aulas do Protocolo e os bônus.**
⚠️ Confira se consegue acessar. Caso tenha qualquer dificuldade, é só me chamar aqui neste número de suporte.

2️⃣ **Você será adicionada ao grupo de alunas no WhatsApp e removida do grupo anterior.** Esse é o espaço onde acontecem os avisos e monitorias semanais.

3️⃣ **Responda