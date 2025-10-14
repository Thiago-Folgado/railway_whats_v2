const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const app = express();

app.use(express.json());

let whatsappReady = false;
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
// FUNÇÃO AUXILIAR: FORMATAÇÃO DE NÚMERO
// ============================================

async function formatarNumero(numero) {
    console.log(`🔍 Formatando número: ${numero}`);
    
    const numeroLimpo = numero.replace(/\D/g, '');
    let numeroBase;
    
    // ============================================
    // LÓGICA ESPECIAL: Número com 10 dígitos
    // ============================================
    // Se o número tem exatamente 10 dígitos (DDD + 8 dígitos)
    // Adiciona o "9" como terceiro caractere
    // Exemplo: 3197629068 -> 31997629068
    if (numeroLimpo.length === 10) {
        const ddd = numeroLimpo.substring(0, 2);
        const numeroSem9 = numeroLimpo.substring(2);
        const numeroCom9 = ddd + '9' + numeroSem9;
        
        console.log(`📱 Número com 10 dígitos detectado`);
        console.log(`   DDD: ${ddd}`);
        console.log(`   Número original: ${numeroSem9} (8 dígitos)`);
        console.log(`   Número com 9 adicionado: ${numeroCom9} (11 dígitos)`);
        
        numeroBase = '55' + numeroCom9;
        console.log(`   Número final com código país: ${numeroBase}`);
    }
    // ============================================
    // LÓGICA NORMAL: Outros formatos
    // ============================================
    else if (numeroLimpo.length === 13 || numeroLimpo.length === 12) {
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
    } else if (numeroLimpo.length === 11) {
        numeroBase = '55' + numeroLimpo;
    } else {
        numeroBase = numeroLimpo.startsWith('55') ? numeroLimpo : '55' + numeroLimpo;
    }
    
    console.log(`📱 Número base: ${numeroBase} (${numeroBase.length} dígitos)`);
    
    // Para números com 13 dígitos (55 + DDD + 9 dígitos)
    if (numeroBase.length === 13) {
        const ddd = numeroBase.substring(2, 4);
        const numeroComNove = numeroBase.substring(4);
        const numeroSemNove = numeroComNove.substring(1);
        
        const formato8Digitos = '55' + ddd + numeroSemNove + '@c.us';
        const formato9Digitos = '55' + ddd + numeroComNove + '@c.us';
        
        console.log(`🔄 Testando formato sem 9: ${formato8Digitos}`);
        const funciona8 = await testarNumero(formato8Digitos);
        if (funciona8) {
            console.log(`✅ Formato sem 9 confirmado!`);
            return formato8Digitos;
        }
        
        console.log(`🔄 Testando formato com 9: ${formato9Digitos}`);
        const funciona9 = await testarNumero(formato9Digitos);
        if (funciona9) {
            console.log(`✅ Formato com 9 confirmado!`);
            return formato9Digitos;
        }
        
        throw new Error(`Número não encontrado no WhatsApp: ${numero}`);
    }
    
    // Para números com 12 dígitos (55 + DDD + 8 dígitos)
    if (numeroBase.length === 12) {
        const numeroFormatado = numeroBase + '@c.us';
        const funciona = await testarNumero(numeroFormatado);
        if (funciona) {
            console.log(`✅ Formato confirmado!`);
            return numeroFormatado;
        }
        throw new Error(`Número não encontrado no WhatsApp: ${numero}`);
    }
    
    throw new Error(`Formato de número não reconhecido: ${numero}`);
}

async function testarNumero(numeroFormatado) {
    try {
        const mensagem = await client.sendMessage(numeroFormatado, '⠀');
        
        let ackFinal = mensagem.ack;
        const tempoMaximo = 20000;
        const intervalo = 500;
        let tempoDecorrido = 0;
        
        while (tempoDecorrido < tempoMaximo && ackFinal < 2) {
            await new Promise(resolve => setTimeout(resolve, intervalo));
            tempoDecorrido += intervalo;
            
            try {
                const chat = await client.getChatById(numeroFormatado);
                const mensagens = await chat.fetchMessages({ limit: 1 });
                if (mensagens.length > 0 && mensagens[0].id.id === mensagem.id.id) {
                    ackFinal = mensagens[0].ack;
                    if (ackFinal >= 2) break;
                }
            } catch (fetchErr) {
                // Ignorar erros de busca
            }
        }
        
        if (ackFinal >= 2) {
            try {
                await mensagem.delete(true);
            } catch (delErr) {
                // Ignorar erro ao deletar
            }
            return true;
        }
        
        try {
            await mensagem.delete(true);
        } catch (delErr) {
            // Ignorar erro ao deletar
        }
        
        return false;
        
    } catch (err) {
        return false;
    }
}

// ============================================
// FUNÇÃO AUXILIAR: FORMATAÇÃO SIMPLES (SEM VALIDAÇÃO)
// ============================================

function formatarNumeroSimples(numero) {
    console.log(`🔍 Formatando número (sem validação): ${numero}`);
    
    const numeroLimpo = numero.replace(/\D/g, '');
    let numeroBase;
    
    // Número com 10 dígitos: adiciona o 9
    if (numeroLimpo.length === 10) {
        const ddd = numeroLimpo.substring(0, 2);
        const numeroSem9 = numeroLimpo.substring(2);
        const numeroCom9 = ddd + '9' + numeroSem9;
        numeroBase = '55' + numeroCom9;
        console.log(`   10 dígitos → ${numeroBase}`);
    }
    // Número com 11 dígitos: adiciona código país
    else if (numeroLimpo.length === 11) {
        numeroBase = '55' + numeroLimpo;
        console.log(`   11 dígitos → ${numeroBase}`);
    }
    // Número com 12 dígitos
    else if (numeroLimpo.length === 12) {
        if (numeroLimpo.startsWith('55')) {
            numeroBase = numeroLimpo;
        } else {
            numeroBase = '55' + numeroLimpo;
        }
        console.log(`   12 dígitos → ${numeroBase}`);
    }
    // Número com 13 dígitos
    else if (numeroLimpo.length === 13) {
        if (numeroLimpo.startsWith('55')) {
            numeroBase = numeroLimpo;
        } else {
            numeroBase = '55' + numeroLimpo;
        }
        console.log(`   13 dígitos → ${numeroBase}`);
    }
    else {
        numeroBase = numeroLimpo.startsWith('55') ? numeroLimpo : '55' + numeroLimpo;
        console.log(`   Outro formato → ${numeroBase}`);
    }
    
    const numeroFormatado = numeroBase + '@c.us';
    console.log(`✅ Número formatado: ${numeroFormatado}`);
    return numeroFormatado;
}

// ============================================
// ENDPOINTS DA API (MINIMALISTA)
// ============================================

// Status e Health Check
app.get('/', (req, res) => {
    res.json({ 
        status: 'WhatsApp Bot Minimalista v2.0',
        whatsappReady,
        timestamp: new Date().toISOString(),
        endpoints: {
            status: 'GET /status',
            health: 'GET /health',
            qr: 'GET /qr-page',
            sendMessage: 'POST /send-message',
            addToGroup: 'POST /add-to-group',
            listGroups: 'GET /list-groups',
            testFormat: 'POST /test-format'
        },
        note: 'Versão otimizada - validação apenas no send-message'
    });
});

app.get('/status', (req, res) => {
    res.json({ 
        whatsappReady,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        uptime: process.uptime()
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
// ENDPOINT 1: ENVIAR MENSAGEM (VALIDAÇÃO INTELIGENTE)
// ============================================

app.post('/send-message', async (req, res) => {
    console.log('\n📨 /send-message chamado');
    
    if (!whatsappReady) {
        return res.status(503).json({ 
            success: false,
            error: 'WhatsApp não está pronto' 
        });
    }
    
    const { numero, mensagem } = req.body;
    
    if (!numero || !mensagem) {
        return res.status(400).json({ 
            success: false,
            error: 'Campos obrigatórios: numero, mensagem' 
        });
    }
    
    try {
        let numeroFormatado;
        
        // ============================================
        // LÓGICA INTELIGENTE: Detecta se já foi validado
        // ============================================
        
        // Se o número termina com @c.us = JÁ FOI VALIDADO ANTES
        if (numero.includes('@c.us')) {
            console.log('✅ NÚMERO JÁ VALIDADO ANTERIORMENTE!');
            console.log(`   Usando direto: ${numero}`);
            numeroFormatado = numero;
        } 
        // Se não tem @c.us = PRIMEIRA VEZ, precisa validar
        else {
            console.log('🔍 PRIMEIRA VALIDAÇÃO - Testando número no WhatsApp...');
            numeroFormatado = await formatarNumero(numero);
            console.log(`✅ Número validado pela primeira vez: ${numeroFormatado}`);
        }
        
        // Envia a mensagem
        await client.sendMessage(numeroFormatado, mensagem);
        
        console.log(`✅ Mensagem enviada para ${numeroFormatado}`);
        
        res.json({ 
            success: true,
            numeroOriginal: numero,
            numeroFormatado: numeroFormatado,
            jaValidado: numero.includes('@c.us'),
            message: 'Mensagem enviada com sucesso'
        });
        
    } catch (err) {
        console.error(`❌ Erro:`, err);
        res.status(500).json({ 
            success: false,
            numeroOriginal: numero,
            error: err.message 
        });
    }
});

// ============================================
// ENDPOINT 2: ADICIONAR A GRUPO (VALIDAÇÃO INTELIGENTE)
// ============================================

app.post('/add-to-group', async (req, res) => {
    console.log('\n👥 /add-to-group chamado');
    
    if (!whatsappReady) {
        return res.status(503).json({ 
            success: false,
            error: 'WhatsApp não está pronto' 
        });
    }
    
    const { numero, nomeGrupo } = req.body;
    
    if (!numero || !nomeGrupo) {
        return res.status(400).json({ 
            success: false,
            error: 'Campos obrigatórios: numero, nomeGrupo' 
        });
    }
    
    try {
        let numeroFormatado;
        
        // ============================================
        // LÓGICA INTELIGENTE: Detecta se já foi validado
        // ============================================
        
        // Se o número termina com @c.us = JÁ FOI VALIDADO
        if (numero.includes('@c.us')) {
            console.log('✅ NÚMERO JÁ VALIDADO - Usando direto');
            numeroFormatado = numero;
        } 
        // Se não tem @c.us = Apenas formata (sem validar)
        else {
            console.log('📝 Formatação simples (sem validação)');
            numeroFormatado = formatarNumeroSimples(numero);
        }
        
        const chats = await client.getChats();
        const grupo = chats.find(chat => chat.isGroup && chat.name === nomeGrupo);
        
        if (!grupo) {
            return res.status(404).json({ 
                success: false,
                error: `Grupo "${nomeGrupo}" não encontrado` 
            });
        }
        
        await grupo.addParticipants([numeroFormatado]);
        
        console.log(`✅ ${numeroFormatado} adicionado ao grupo "${nomeGrupo}"`);
        
        res.json({ 
            success: true,
            numeroOriginal: numero,
            numeroFormatado: numeroFormatado,
            grupo: nomeGrupo,
            jaValidado: numero.includes('@c.us'),
            message: 'Contato adicionado ao grupo com sucesso'
        });
        
    } catch (err) {
        console.error(`❌ Erro:`, err);
        res.status(500).json({ 
            success: false,
            numeroOriginal: numero,
            error: err.message 
        });
    }
});

// ============================================
// ENDPOINT AUXILIAR: LISTAR GRUPOS
// ============================================

app.get('/list-groups', async (req, res) => {
    console.log('\n📋 /list-groups chamado');
    
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
        
        res.json({ 
            success: true,
            grupos,
            total: grupos.length
        });
        
    } catch (err) {
        console.error(`❌ Erro:`, err);
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
});

// ============================================
// ENDPOINT DE TESTE: VALIDAR FORMATAÇÃO
// ============================================

app.post('/test-format', async (req, res) => {
    console.log('\n🧪 /test-format chamado');
    
    const { numero } = req.body;
    
    if (!numero) {
        return res.status(400).json({ 
            success: false,
            error: 'Campo obrigatório: numero' 
        });
    }
    
    try {
        const numeroLimpo = numero.replace(/\D/g, '');
        console.log(`📱 Número original: ${numero}`);
        console.log(`🧹 Número limpo: ${numeroLimpo}`);
        console.log(`📏 Tamanho: ${numeroLimpo.length} dígitos`);
        
        let resultado = {
            numeroOriginal: numero,
            numeroLimpo: numeroLimpo,
            tamanho: numeroLimpo.length,
            etapas: []
        };
        
        if (numeroLimpo.length === 10) {
            const ddd = numeroLimpo.substring(0, 2);
            const numeroSem9 = numeroLimpo.substring(2);
            const numeroCom9 = ddd + '9' + numeroSem9;
            const numeroFinal = '55' + numeroCom9;
            
            resultado.etapas.push({
                passo: 1,
                descricao: '10 dígitos detectado (DDD + 8 dígitos)',
                valor: numeroLimpo
            });
            resultado.etapas.push({
                passo: 2,
                descricao: 'DDD extraído',
                valor: ddd
            });
            resultado.etapas.push({
                passo: 3,
                descricao: 'Número sem 9',
                valor: numeroSem9
            });
            resultado.etapas.push({
                passo: 4,
                descricao: '9 adicionado como terceiro caractere',
                valor: numeroCom9
            });
            resultado.etapas.push({
                passo: 5,
                descricao: 'Código país 55 adicionado',
                valor: numeroFinal
            });
            resultado.etapas.push({
                passo: 6,
                descricao: 'Formato WhatsApp final',
                valor: numeroFinal + '@c.us'
            });
            
            resultado.numeroFormatado = numeroFinal;
            resultado.numeroWhatsApp = numeroFinal + '@c.us';
            resultado.regra = 'NÚMERO COM 10 DÍGITOS - 9 ADICIONADO';
        } else if (numeroLimpo.length === 11) {
            const numeroFinal = '55' + numeroLimpo;
            
            resultado.etapas.push({
                passo: 1,
                descricao: '11 dígitos detectado (DDD + 9 dígitos)',
                valor: numeroLimpo
            });
            resultado.etapas.push({
                passo: 2,
                descricao: 'Código país 55 adicionado',
                valor: numeroFinal
            });
            resultado.etapas.push({
                passo: 3,
                descricao: 'Formato WhatsApp final',
                valor: numeroFinal + '@c.us'
            });
            
            resultado.numeroFormatado = numeroFinal;
            resultado.numeroWhatsApp = numeroFinal + '@c.us';
            resultado.regra = 'NÚMERO COM 11 DÍGITOS - FORMATO MODERNO';
        } else {
            resultado.numeroFormatado = 'N/A';
            resultado.numeroWhatsApp = 'N/A';
            resultado.regra = 'FORMATO NÃO RECONHECIDO';
            resultado.etapas.push({
                passo: 1,
                descricao: 'Tamanho não reconhecido',
                valor: `${numeroLimpo.length} dígitos`
            });
        }
        
        console.log(`✅ Resultado: ${resultado.numeroWhatsApp}`);
        
        res.json({ 
            success: true,
            ...resultado
        });
        
    } catch (err) {
        console.error(`❌ Erro:`, err);
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
});

// ============================================
// INICIALIZAÇÃO
// ============================================

console.log('🚀 Inicializando WhatsApp...');
client.initialize();

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📍 Acesse: http://localhost:${PORT}`);
    console.log(`📱 QR Code: http://localhost:${PORT}/qr-page`);
});

process.on('SIGINT', () => {
    console.log('🔄 Encerrando...');
    client.destroy();
    process.exit(0);
});