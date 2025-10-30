const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const app = express();

app.use(express.json());

let whatsappReady = false;
let qrString = '';

// ============================================
// FILA DE REQUISIÇÕES (ASSÍNCRONO)
// ============================================
class RequestQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    async add(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        const { fn, resolve, reject } = this.queue.shift();
        
        try {
            const result = await fn();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.processing = false;
            this.process(); // Processa próximo da fila
        }
    }
}

const requestQueue = new RequestQueue();

// ============================================
// WHATSAPP CLIENT
// ============================================
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

// ============================================
// EVENTOS WHATSAPP
// ============================================
client.on('qr', async (qr) => {
    console.log('🔗 QR CODE GERADO!');
    qrString = qr;
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp conectado!');
    whatsappReady = true;
    qrString = '';
});

client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp desconectado:', reason);
    whatsappReady = false;
});

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

async function validarNumeroCompleto(numero) {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 VALIDAÇÃO DE NÚMERO INICIADA`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`📱 Número recebido: ${numero}`);
    console.log(`${'='.repeat(60)}\n`);
    
    const numeroLimpo = numero.replace(/\D/g, '');
    console.log(`🧹 Número limpo: ${numeroLimpo} (${numeroLimpo.length} dígitos)`);
    
    let numeroBase;
    
    // Lógica de formatação
    if (numeroLimpo.length === 10) {
        const ddd = numeroLimpo.substring(0, 2);
        const numeroSem9 = numeroLimpo.substring(2);
        const numeroCom9 = ddd + '9' + numeroSem9;
        numeroBase = '55' + numeroCom9;
        
        console.log(`📋 Detecção: 10 dígitos (formato antigo)`);
        console.log(`   └─ DDD: ${ddd}`);
        console.log(`   └─ Número sem 9: ${numeroSem9}`);
        console.log(`   └─ Número com 9: ${numeroCom9}`);
        console.log(`   └─ Com código país: ${numeroBase}`);
    }
    else if (numeroLimpo.length === 11) {
        numeroBase = '55' + numeroLimpo;
        console.log(`📋 Detecção: 11 dígitos (formato moderno)`);
        console.log(`   └─ Com código país: ${numeroBase}`);
    }
    else if (numeroLimpo.length === 12 || numeroLimpo.length === 13) {
        if (numeroLimpo.startsWith('55')) {
            const possivelDDD = numeroLimpo.substring(2, 4);
            const dddNumerico = parseInt(possivelDDD);
            
            if (dddNumerico >= 11 && dddNumerico <= 99) {
                numeroBase = numeroLimpo;
            } else {
                numeroBase = '55' + numeroLimpo;
            }
        } else {
            numeroBase = '55' + numeroLimpo;
        }
        console.log(`📋 Detecção: ${numeroLimpo.length} dígitos`);
        console.log(`   └─ Número base: ${numeroBase}`);
    }
    else {
        numeroBase = numeroLimpo.startsWith('55') ? numeroLimpo : '55' + numeroLimpo;
        console.log(`⚠️ Formato não padrão: ${numeroLimpo.length} dígitos`);
        console.log(`   └─ Número base: ${numeroBase}`);
    }
    
    // Validação no WhatsApp
    console.log(`\n🔄 Iniciando validação no WhatsApp...`);
    
    if (numeroBase.length === 13) {
        const ddd = numeroBase.substring(2, 4);
        const numeroComNove = numeroBase.substring(4);
        const numeroSemNove = numeroComNove.substring(1);
        
        const formato8 = '55' + ddd + numeroSemNove + '@c.us';
        const formato9 = '55' + ddd + numeroComNove + '@c.us';
        
        console.log(`📊 Testando 2 formatos possíveis:`);
        console.log(`   1️⃣ Sem 9: ${formato8}`);
        console.log(`   2️⃣ Com 9: ${formato9}`);
        
        console.log(`\n🧪 Teste 1/2: Formato sem 9...`);
        const funciona8 = await testarNumeroNoWhatsApp(formato8);
        if (funciona8) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ VALIDAÇÃO CONCLUÍDA COM SUCESSO!`);
            console.log(`📱 Formato correto: SEM o 9`);
            console.log(`📞 Número validado: ${formato8}`);
            console.log(`⏱️ Tempo total: ${duration}s`);
            console.log(`${'='.repeat(60)}\n`);
            return formato8;
        }
        
        console.log(`\n🧪 Teste 2/2: Formato com 9...`);
        const funciona9 = await testarNumeroNoWhatsApp(formato9);
        if (funciona9) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ VALIDAÇÃO CONCLUÍDA COM SUCESSO!`);
            console.log(`📱 Formato correto: COM o 9`);
            console.log(`📞 Número validado: ${formato9}`);
            console.log(`⏱️ Tempo total: ${duration}s`);
            console.log(`${'='.repeat(60)}\n`);
            return formato9;
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n${'='.repeat(60)}`);
        console.log(`❌ VALIDAÇÃO FALHOU!`);
        console.log(`📱 Número não encontrado no WhatsApp`);
        console.log(`⏱️ Tempo total: ${duration}s`);
        console.log(`${'='.repeat(60)}\n`);
        throw new Error(`Número não encontrado no WhatsApp: ${numero}`);
    }
    
    if (numeroBase.length === 12) {
        const numeroFormatado = numeroBase + '@c.us';
        console.log(`📊 Testando formato único: ${numeroFormatado}`);
        
        const funciona = await testarNumeroNoWhatsApp(numeroFormatado);
        if (funciona) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ VALIDAÇÃO CONCLUÍDA COM SUCESSO!`);
            console.log(`📞 Número validado: ${numeroFormatado}`);
            console.log(`⏱️ Tempo total: ${duration}s`);
            console.log(`${'='.repeat(60)}\n`);
            return numeroFormatado;
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n${'='.repeat(60)}`);
        console.log(`❌ VALIDAÇÃO FALHOU!`);
        console.log(`📱 Número não encontrado no WhatsApp`);
        console.log(`⏱️ Tempo total: ${duration}s`);
        console.log(`${'='.repeat(60)}\n`);
        throw new Error(`Número não encontrado no WhatsApp: ${numero}`);
    }
    
    throw new Error(`Formato de número não reconhecido: ${numero}`);
}

async function testarNumeroNoWhatsApp(numeroFormatado) {
    const testStart = Date.now();
    console.log(`   ⏳ Enviando mensagem de teste...`);
    
    try {
        const mensagem = await client.sendMessage(numeroFormatado, '⠀');
        console.log(`   ✓ Mensagem enviada (ACK inicial: ${mensagem.ack})`);
        
        let ackFinal = mensagem.ack;
        const tempoMaximo = 30000; // 30 segundos
        const intervalo = 500;
        let tempoDecorrido = 0;
        
        console.log(`   ⏳ Aguardando confirmação de entrega (até 30s)...`);
        
        while (tempoDecorrido < tempoMaximo && ackFinal < 2) {
            await new Promise(resolve => setTimeout(resolve, intervalo));
            tempoDecorrido += intervalo;
            
            try {
                const chat = await client.getChatById(numeroFormatado);
                const mensagens = await chat.fetchMessages({ limit: 1 });
                if (mensagens.length > 0 && mensagens[0].id.id === mensagem.id.id) {
                    const ackAtual = mensagens[0].ack;
                    if (ackAtual !== ackFinal) {
                        ackFinal = ackAtual;
                        console.log(`   📊 ACK atualizado: ${ackFinal} (${tempoDecorrido}ms)`);
                    }
                    if (ackFinal >= 2) break;
                }
            } catch (fetchErr) {
                // Ignorar erros de busca
            }
        }
        
        const testDuration = ((Date.now() - testStart) / 1000).toFixed(2);
        
        if (ackFinal >= 2) {
            console.log(`   ✅ Mensagem ENTREGUE! (ACK: ${ackFinal}, Tempo: ${testDuration}s)`);
            try {
                await mensagem.delete(true);
                console.log(`   🗑️ Mensagem de teste deletada`);
            } catch (delErr) {
                console.log(`   ⚠️ Não foi possível deletar mensagem de teste`);
            }
            return true;
        }
        
        console.log(`   ❌ Timeout: Mensagem não entregue (ACK: ${ackFinal}, Tempo: ${testDuration}s)`);
        try {
            await mensagem.delete(true);
        } catch (delErr) {
            // Ignorar
        }
        return false;
        
    } catch (err) {
        const testDuration = ((Date.now() - testStart) / 1000).toFixed(2);
        console.log(`   ❌ Erro no teste: ${err.message} (Tempo: ${testDuration}s)`);
        return false;
    }
}

// ============================================
// ENDPOINTS - STATUS
// ============================================
app.get('/', (req, res) => {
    res.json({ 
        status: 'WhatsApp Bot v3.0 - Assíncrono',
        whatsappReady,
        queueSize: requestQueue.queue.length,
        processing: requestQueue.processing,
        timestamp: new Date().toISOString(),
        endpoints: {
            status: 'GET /status',
            health: 'GET /health',
            qr: 'GET /qr-page',
            validateNumber: 'POST /validate-number (novo!)',
            sendMessage: 'POST /send-message',
            addToGroup: 'POST /add-to-group',
            listGroups: 'GET /list-groups'
        }
    });
});

app.get('/status', (req, res) => {
    res.json({ 
        whatsappReady,
        queueSize: requestQueue.queue.length,
        processing: requestQueue.processing,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        uptime: process.uptime(),
        whatsappReady
    });
});

// QR Code
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
                    }
                    h1 { color: #25D366; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 WhatsApp Bot</h1>
                    <p>⏳ QR Code ainda não foi gerado...</p>
                    <button onclick="location.reload()">🔄 Atualizar</button>
                </div>
                <script>setTimeout(() => location.reload(), 5000);</script>
            </body>
            </html>
        `);
    }

    QRCode.toDataURL(qrString, { width: 300, margin: 2 }, (err, url) => {
        if (err) return res.status(500).send('Erro ao gerar QR code');
        
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
                    }
                    h1 { color: #25D366; }
                    .qr-code { 
                        margin: 20px 0; 
                        padding: 20px;
                        background: #f8f9fa;
                        border-radius: 10px;
                    }
                    .qr-code img { 
                        max-width: 100%; 
                        border-radius: 8px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 WhatsApp Bot</h1>
                    <div class="qr-code">
                        <img src="${url}" alt="QR Code" />
                    </div>
                    <p>✅ Escaneie o QR code com seu WhatsApp</p>
                </div>
            </body>
            </html>
        `);
    });
});

// ============================================
// ENDPOINT 1: VALIDAR NÚMERO (NOVO!)
// ============================================
app.post('/validate-number', async (req, res) => {
    const requestId = `REQ-${Date.now()}`;
    console.log(`\n🆔 Request ID: ${requestId}`);
    console.log(`📥 POST /validate-number`);
    
    if (!whatsappReady) {
        console.log(`❌ WhatsApp não está pronto`);
        return res.status(503).json({ 
            success: false,
            error: 'WhatsApp não está pronto',
            requestId
        });
    }
    
    const { numero } = req.body;
    
    if (!numero) {
        console.log(`❌ Número não fornecido`);
        return res.status(400).json({ 
            success: false,
            error: 'Campo obrigatório: numero',
            requestId
        });
    }
    
    try {
        const resultado = await requestQueue.add(async () => {
            return await validarNumeroCompleto(numero);
        });
        
        res.json({ 
            success: true,
            numeroOriginal: numero,
            numeroValidado: resultado,
            requestId,
            message: 'Número validado com sucesso'
        });
        
    } catch (err) {
        console.error(`\n${'='.repeat(60)}`);
        console.error(`❌ ERRO NA VALIDAÇÃO`);
        console.error(`🆔 Request ID: ${requestId}`);
        console.error(`📱 Número: ${numero}`);
        console.error(`💥 Erro: ${err.message}`);
        console.error(`${'='.repeat(60)}\n`);
        
        res.status(500).json({ 
            success: false,
            numeroOriginal: numero,
            error: err.message,
            requestId
        });
    }
});

// ============================================
// ENDPOINT 2: ENVIAR MENSAGEM
// ============================================
app.post('/send-message', async (req, res) => {
    const requestId = `REQ-${Date.now()}`;
    const startTime = Date.now();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📨 ENVIO DE MENSAGEM`);
    console.log(`🆔 Request ID: ${requestId}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);
    
    if (!whatsappReady) {
        console.log(`❌ WhatsApp não está pronto\n`);
        return res.status(503).json({ 
            success: false,
            error: 'WhatsApp não está pronto',
            requestId
        });
    }
    
    const { numero, mensagem } = req.body;
    
    if (!numero || !mensagem) {
        console.log(`❌ Dados incompletos`);
        console.log(`   └─ Número: ${numero ? '✓' : '✗'}`);
        console.log(`   └─ Mensagem: ${mensagem ? '✓' : '✗'}\n`);
        return res.status(400).json({ 
            success: false,
            error: 'Campos obrigatórios: numero, mensagem',
            requestId
        });
    }
    
    console.log(`📋 Dados recebidos:`);
    console.log(`   └─ Número: ${numero}`);
    console.log(`   └─ Tamanho mensagem: ${mensagem.length} caracteres\n`);
    
    try {
        const resultado = await requestQueue.add(async () => {
            console.log(`📤 Enviando mensagem...`);
            await client.sendMessage(numero, mensagem);
            return true;
        });
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`✅ MENSAGEM ENVIADA COM SUCESSO!`);
        console.log(`🆔 Request ID: ${requestId}`);
        console.log(`📞 Para: ${numero}`);
        console.log(`⏱️ Tempo total: ${duration}s`);
        console.log(`${'='.repeat(60)}\n`);
        
        res.json({ 
            success: true,
            numero,
            requestId,
            duration: `${duration}s`,
            message: 'Mensagem enviada com sucesso'
        });
        
    } catch (err) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.error(`\n${'='.repeat(60)}`);
        console.error(`❌ ERRO NO ENVIO`);
        console.error(`🆔 Request ID: ${requestId}`);
        console.error(`📞 Para: ${numero}`);
        console.error(`💥 Erro: ${err.message}`);
        console.error(`⏱️ Tempo até erro: ${duration}s`);
        console.error(`${'='.repeat(60)}\n`);
        
        res.status(500).json({ 
            success: false,
            numero,
            error: err.message,
            requestId,
            duration: `${duration}s`
        });
    }
});

// ============================================
// ENDPOINT 3: ADICIONAR AO GRUPO + REMOVER DE OUTROS
// ============================================
app.post('/add-to-group', async (req, res) => {
    const requestId = `REQ-${Date.now()}`;
    const startTime = Date.now();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`👥 GERENCIAMENTO DE GRUPOS`);
    console.log(`🆔 Request ID: ${requestId}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);
    
    if (!whatsappReady) {
        console.log(`❌ WhatsApp não está pronto\n`);
        return res.status(503).json({ 
            success: false,
            error: 'WhatsApp não está pronto',
            requestId
        });
    }
    
    const { numero, nomeGrupo } = req.body;
    
    if (!numero || !nomeGrupo) {
        console.log(`❌ Dados incompletos`);
        console.log(`   └─ Número: ${numero ? '✓' : '✗'}`);
        console.log(`   └─ Grupo: ${nomeGrupo ? '✓' : '✗'}\n`);
        return res.status(400).json({ 
            success: false,
            error: 'Campos obrigatórios: numero, nomeGrupo',
            requestId
        });
    }
    
    console.log(`📋 Dados recebidos:`);
    console.log(`   └─ Número: ${numero}`);
    console.log(`   └─ Grupo destino: ${nomeGrupo}\n`);
    
    try {
        const resultado = await requestQueue.add(async () => {
            // Buscar grupo
            console.log(`🔍 Buscando grupo "${nomeGrupo}"...`);
            const chats = await client.getChats();
            const grupo = chats.find(chat => chat.isGroup && chat.name === nomeGrupo);
            
            if (!grupo) {
                throw new Error(`Grupo "${nomeGrupo}" não encontrado`);
            }
            
            console.log(`✓ Grupo encontrado (${grupo.participants.length} participantes)\n`);
            
            // Adicionar ao grupo
            console.log(`➕ Adicionando ${numero} ao grupo...`);
            await grupo.addParticipants([numero]);
            console.log(`✅ Adicionado com sucesso!\n`);
            
            // Remover de outros grupos
            console.log(`🔄 Verificando outros grupos...`);
            const todosGrupos = chats.filter(chat => chat.isGroup);
            let gruposRemovidos = [];
            
            for (const outroGrupo of todosGrupos) {
                if (outroGrupo.name === nomeGrupo) continue;
                
                const euSouAdmin = outroGrupo.participants.some(
                    p => p.id._serialized === client.info.wid._serialized && 
                         (p.isAdmin || p.isSuperAdmin)
                );
                
                if (!euSouAdmin) continue;
                
                const estaNoGrupo = outroGrupo.participants.some(
                    p => p.id._serialized === numero
                );
                
                if (estaNoGrupo) {
                    console.log(`   🗑️ Removendo de: ${outroGrupo.name}`);
                    await outroGrupo.removeParticipants([numero]);
                    gruposRemovidos.push(outroGrupo.name);
                }
            }
            
            if (gruposRemovidos.length > 0) {
                console.log(`✅ Removido de ${gruposRemovidos.length} grupo(s)\n`);
            } else {
                console.log(`ℹ️ Não estava em outros grupos\n`);
            }
            
            return { gruposRemovidos };
        });
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`${'='.repeat(60)}`);
        console.log(`✅ OPERAÇÃO CONCLUÍDA COM SUCESSO!`);
        console.log(`🆔 Request ID: ${requestId}`);
        console.log(`📞 Número: ${numero}`);
        console.log(`👥 Grupo: ${nomeGrupo}`);
        console.log(`🗑️ Removido de: ${resultado.gruposRemovidos.length} grupo(s)`);
        console.log(`⏱️ Tempo total: ${duration}s`);
        console.log(`${'='.repeat(60)}\n`);
        
        res.json({ 
            success: true,
            numero,
            grupo: nomeGrupo,
            gruposRemovidos: resultado.gruposRemovidos,
            totalRemovido: resultado.gruposRemovidos.length,
            requestId,
            duration: `${duration}s`,
            message: 'Contato gerenciado com sucesso'
        });
        
    } catch (err) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.error(`\n${'='.repeat(60)}`);
        console.error(`❌ ERRO NO GERENCIAMENTO`);
        console.error(`🆔 Request ID: ${requestId}`);
        console.error(`📞 Número: ${numero}`);
        console.error(`👥 Grupo: ${nomeGrupo}`);
        console.error(`💥 Erro: ${err.message}`);
        console.error(`⏱️ Tempo até erro: ${duration}s`);
        console.error(`${'='.repeat(60)}\n`);
        
        res.status(500).json({ 
            success: false,
            numero,
            grupo: nomeGrupo,
            error: err.message,
            requestId,
            duration: `${duration}s`
        });
    }
});

// ============================================
// ENDPOINT AUXILIAR: LISTAR GRUPOS
// ============================================
app.get('/list-groups', async (req, res) => {
    console.log(`\n📋 GET /list-groups`);
    
    if (!whatsappReady) {
        return res.status(503).json({ 
            success: false,
            error: 'WhatsApp não está pronto'
        });
    }
    
    try {
        const chats = await client.getChats();
        const grupos = chats
            .filter(chat => chat.isGroup)
            .map(grupo => ({
                nome: grupo.name,
                participantes: grupo.participants?.length || 0,
                souAdmin: grupo.participants.some(
                    p => p.id._serialized === client.info.wid._serialized && 
                         (p.isAdmin || p.isSuperAdmin)
                )
            }));
        
        console.log(`✅ ${grupos.length} grupo(s) encontrado(s)\n`);
        
        res.json({ 
            success: true,
            grupos,
            total: grupos.length
        });
        
    } catch (err) {
        console.error(`❌ Erro: ${err.message}\n`);
        res.status(500).json({ 
            success: false,
            error: err.message
        });
    }
});

// ============================================
// INICIALIZAÇÃO
// ============================================
console.log('🚀 Inicializando WhatsApp Bot v3.0...');
client.initialize();

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 SERVIDOR RODANDO`);
    console.log(`📍 Porta: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`📱 QR Code: http://localhost:${PORT}/qr-page`);
    console.log(`${'='.repeat(60)}\n`);
});

process.on('SIGINT', () => {
    console.log('\n🔄 Encerrando servidor...');
    client.destroy();
    process.exit(0);
});