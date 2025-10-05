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
    console.log(`IP: ${req.ip}`);
    console.log(`User-Agent: ${req.get('User-Agent')}`);
    console.log(`Headers:`, req.headers);
    console.log(`Body:`, req.body);
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
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    }
});

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

client.on('disconnected', (reason) => {
    console.log('\n' + '❌'.repeat(20));
    console.log('❌ WhatsApp desconectado:', reason);
    console.log(`⏰ Desconectado em: ${new Date().toISOString()}`);
    console.log('❌'.repeat(20) + '\n');
    whatsappReady = false;
    currentQRCode = null;
    qrString = '';
});

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

async function verificarNumeroWhatsApp(numero) {
    console.log(`\n🔍 === VERIFICAÇÃO DE NÚMERO ===`);
    console.log(`📱 Número recebido: ${numero}`);
    
    const numeroLimpo = numero.replace(/\D/g, '');
    console.log(`🧹 Número limpo: ${numeroLimpo}`);
    
    let numeroBase = numeroLimpo.startsWith('55') ? numeroLimpo : '55' + numeroLimpo;
    console.log(`🇧🇷 Número com código do país: ${numeroBase}`);
    console.log(`📏 Tamanho: ${numeroBase.length} dígitos`);
    
    // Para números com 13 dígitos (55 + DDD + 9 dígitos)
    if (numeroBase.length === 13) {
        const ddd = numeroBase.substring(2, 4);
        const numeroComNove = numeroBase.substring(4); // 9 dígitos
        const numeroSemNove = numeroComNove.substring(1); // Remove o primeiro dígito (o 9)
        
        console.log(`📍 DDD: ${ddd}`);
        console.log(`📞 Número completo: ${numeroComNove} (${numeroComNove.length} dígitos)`);
        
        // Preparar ambos os formatos para testar
        const formato8Digitos = '55' + ddd + numeroSemNove + '@c.us'; // Ex: 553197629068@c.us
        const formato9Digitos = '55' + ddd + numeroComNove + '@c.us'; // Ex: 5531997629068@c.us
        
        console.log(`\n🔄 TESTE REAL: Verificando qual formato tem destinatário válido...`);
        console.log(`   📱 Formato SEM 9: ${formato8Digitos}`);
        console.log(`   📱 Formato COM 9: ${formato9Digitos}`);
        
        // Função auxiliar para testar se um número tem destinatário real
        async function testarNumeroReal(numeroFormatado) {
            try {
                console.log(`\n   🧪 Testando: ${numeroFormatado}`);
                
                // Enviar mensagem de teste invisível (apenas texto vazio)
                const mensagem = await client.sendMessage(numeroFormatado, '⠀'); // Espaço invisível Unicode
                
                console.log(`   📊 Status inicial: ACK ${mensagem.ack}`);
                
                // Aguardar até 5 segundos para o WhatsApp processar e atualizar o ACK
                let ackFinal = mensagem.ack;
                const tempoMaximo = 5000; // 5 segundos
                const intervalo = 500; // Verifica a cada 500ms
                let tempoDecorrido = 0;
                
                while (tempoDecorrido < tempoMaximo && ackFinal < 1) {
                    await new Promise(resolve => setTimeout(resolve, intervalo));
                    tempoDecorrido += intervalo;
                    
                    // Buscar a mensagem novamente para pegar o ACK atualizado
                    try {
                        const chat = await client.getChatById(numeroFormatado);
                        const mensagens = await chat.fetchMessages({ limit: 1 });
                        if (mensagens.length > 0 && mensagens[0].id.id === mensagem.id.id) {
                            ackFinal = mensagens[0].ack;
                            console.log(`   ⏱️ ${tempoDecorrido}ms: ACK atualizado para ${ackFinal}`);
                            
                            if (ackFinal >= 1) break; // Já foi entregue
                        }
                    } catch (fetchErr) {
                        // Ignorar erros de busca
                    }
                }
                
                console.log(`   📊 Status final após ${tempoDecorrido}ms:`);
                console.log(`      - ID: ${mensagem.id.id}`);
                console.log(`      - ACK final: ${ackFinal}`);
                
                // ACK 1 = Enviado para o servidor
                // ACK 2 = Entregue no dispositivo do destinatário
                // ACK 3 = Lido
                // ACK 0 ou -1 = Falha/Não entregue
                
                if (ackFinal >= 1) {
                    console.log(`   ✅ Mensagem ENTREGUE! (ACK: ${ackFinal})`);
                    
                    // Tentar deletar a mensagem de teste
                    try {
                        await mensagem.delete(true); // true = deletar para todos
                        console.log(`   🗑️ Mensagem de teste deletada`);
                    } catch (delErr) {
                        console.log(`   ⚠️ Não foi possível deletar a mensagem de teste`);
                    }
                    
                    return true;
                }
                
                console.log(`   ❌ Mensagem NÃO foi entregue (ACK: ${ackFinal})`);
                
                // Tentar deletar mesmo assim
                try {
                    await mensagem.delete(true);
                } catch (delErr) {
                    // Ignorar erro
                }
                
                return false;
                
            } catch (err) {
                console.log(`   ❌ Erro ao testar: ${err.message}`);
                return false;
            }
        }
        
        // TESTAR formato SEM 9 primeiro (mais comum ser o correto)
        const funciona8 = await testarNumeroReal(formato8Digitos);
        if (funciona8) {
            console.log(`\n✅ CONFIRMADO: Formato SEM 9 tem destinatário real!`);
            console.log(`✅ USANDO: ${formato8Digitos}`);
            console.log(`=================================\n`);
            return formato8Digitos;
        }
        
        // Se não funcionou sem 9, testar COM 9
        const funciona9 = await testarNumeroReal(formato9Digitos);
        if (funciona9) {
            console.log(`\n✅ CONFIRMADO: Formato COM 9 tem destinatário real!`);
            console.log(`✅ USANDO: ${formato9Digitos}`);
            console.log(`=================================\n`);
            return formato9Digitos;
        }
        
        console.log(`\n❌ Número NÃO tem destinatário válido em NENHUM formato`);
        console.log(`   Testado: ${formato8Digitos} e ${formato9Digitos}`);
        console.log(`=================================\n`);
        return null;
    }
    
    // Para números com 12 dígitos (55 + DDD + 8 dígitos)
    if (numeroBase.length === 12) {
        console.log(`\n🔄 Número tem 12 dígitos (formato sem o 9)`);
        const numeroFormatado = numeroBase + '@c.us';
        console.log(`   Testando: ${numeroFormatado}`);
        
        try {
            const mensagem = await client.sendMessage(numeroFormatado, '⠀');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (mensagem.ack >= 1) {
                console.log(`   ✅ ENCONTRADO!`);
                try {
                    await mensagem.delete(true);
                } catch (delErr) {
                    // Ignorar erro de deletar
                }
                console.log(`\n✅ USANDO: ${numeroFormatado}`);
                console.log(`=================================\n`);
                return numeroFormatado;
            }
        } catch (err) {
            console.log(`   ❌ Não encontrado: ${err.message}`);
        }
    }
    
    console.log(`\n❌ FORMATO DE NÚMERO NÃO RECONHECIDO`);
    console.log(`   Tamanho recebido: ${numeroBase.length} dígitos`);
    console.log(`=================================\n`);
    return null;
}

async function formatarNumero(numero) {
    console.log(`🔍 Iniciando verificação do número: ${numero}`);
    
    const numeroValido = await verificarNumeroWhatsApp(numero);
    
    if (!numeroValido) {
        throw new Error(`❌ Número não encontrado no WhatsApp: ${numero}`);
    }
    
    console.log(`✅ Número validado e formatado: ${numeroValido}`);
    return numeroValido;
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
        if (error?.data) {
            console.error('📄 Detalhes do erro:', JSON.stringify(error.data, null, 2));
        }
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
        console.error(`❌ Erro ao remover ${numeroFormatado} de outros grupos:`, error);
        return false;
    }
}

async function adicionarEtiqueta(numeroFormatado, nomeEtiqueta) {
    try {
        console.log(`\n🏷️  Adicionando etiqueta: "${nomeEtiqueta}"`);
        console.log(`📱 Chat ID: ${numeroFormatado}`);
        
        const labels = await client.getLabels();
        const etiqueta = labels.find(l => l.name === nomeEtiqueta);
        
        if (!etiqueta) {
            console.log(`⚠️  Etiqueta "${nomeEtiqueta}" não existe`);
            return false;
        }
        
        console.log(`✅ Etiqueta encontrada: "${etiqueta.name}" (ID: ${etiqueta.id})`);
        
        // Verificar se o chat existe e testar aplicação
        const resultado = await client.pupPage.evaluate(async (chatId, labelId, labelName) => {
            try {
                // Buscar o chat
                const chat = await window.Store.Chat.get(chatId);
                if (!chat) {
                    return { success: false, error: 'Chat não encontrado' };
                }
                
                // Buscar a label
                const label = window.Store.Label.get(labelId);
                if (!label) {
                    return { success: false, error: 'Label não encontrada no Store' };
                }
                
                // Tentar adicionar
                await window.Store.Label.addOrRemoveLabels([label], [chat]);
                
                // Verificar se foi aplicada
                const chatAtualizado = await window.Store.Chat.get(chatId);
                const temLabel = chatAtualizado.labels && chatAtualizado.labels.includes(labelId);
                
                return { 
                    success: true, 
                    labelAplicada: temLabel,
                    labelsAtuais: chatAtualizado.labels || []
                };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, numeroFormatado, etiqueta.id, nomeEtiqueta);
        
        console.log(`📊 Resultado:`, JSON.stringify(resultado, null, 2));
        
        if (resultado.success && resultado.labelAplicada) {
            console.log(`✅ Etiqueta confirmada no chat!\n`);
            return true;
        } else if (resultado.success && !resultado.labelAplicada) {
            console.log(`⚠️  Código executou mas etiqueta não foi aplicada\n`);
            return false;
        } else {
            console.log(`❌ Falha: ${resultado.error}\n`);
            return false;
        }
        
    } catch (error) {
        console.error(`❌ Erro ao adicionar etiqueta: ${error.message}\n`);
        return false;
    }
}

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

app.post('/send', async (req, res) => {
    const startTime = Date.now();
    console.log('\n' + '📨'.repeat(30));
    console.log('📨 ENDPOINT /SEND CHAMADO');
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log('📨'.repeat(30));
    
    console.log(`🔍 Estado WhatsApp: ${whatsappReady ? '✅ PRONTO' : '❌ NÃO PRONTO'}`);
    console.log(`🔍 QR disponível: ${qrString ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`🔍 Cliente existe: ${client ? '✅ SIM' : '❌ NÃO'}`);
    
    if (!whatsappReady) {
        console.log('❌ ERRO: WhatsApp não está pronto');
        return res.status(503).json({ error: 'WhatsApp não está pronto ainda' });
    }
    
    const { Nome, Numero, Produto, Status } = req.body;
    
    console.log('📋 DADOS RECEBIDOS:');
    console.log(`   👤 Nome: ${Nome || 'NÃO INFORMADO'}`);
    console.log(`   📱 Numero: ${Numero || 'NÃO INFORMADO'}`);
    console.log(`   🎯 Produto: ${Produto || 'NÃO INFORMADO'}`);
    console.log(`   📊 Status: ${Status || 'NÃO INFORMADO'}`);
    
    if (!Nome || !Numero || !Produto || !Status) {
        console.log('❌ ERRO: Dados incompletos');
        return res.status(400).json({ error: 'Campos obrigatórios: Nome, Numero, Produto, Status' });
    }

    try {
        console.log(`\n🔄 Validando e formatando número...`);
        const numeroFormatado = await formatarNumero(Numero);
        console.log(`✅ Número formatado: ${numeroFormatado}`);

        if (Status === "Pagamento Aprovado") {
            console.log('\n✅ STATUS: PAGAMENTO APROVADO');
            console.log('📝 Iniciando processo de onboarding...');
            
            const config = configuracaoProdutos[Produto];
            if (!config) {
                console.log('❌ ERRO: Produto não reconhecido:', Produto);
                return res.status(400).json({ error: 'Produto não reconhecido' });
            }
            
            console.log(`✅ Produto encontrado: ${Produto}`);
            console.log(`🔗 Link: ${config.link}`);
            console.log(`👥 Grupo: ${config.grupo}`);
            
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

            console.log(`📱 Enviando mensagem para: ${numeroFormatado}`);
            console.log('⏳ Aguardando envio da mensagem...');
            
            const messageStartTime = Date.now();
            await client.sendMessage(numeroFormatado, mensagemOnboarding);
            const messageEndTime = Date.now();
            
            console.log(`✅ Mensagem enviada com sucesso! (${messageEndTime - messageStartTime}ms)`);
            
            console.log('👥 Iniciando processo de adição ao grupo...');
            const groupStartTime = Date.now();
            const adicionadoAoGrupo = await adicionarAoGrupo(numeroFormatado, config.grupo);
            const groupEndTime = Date.now();
            console.log(`👥 Processo de grupo finalizado (${groupEndTime - groupStartTime}ms)`);

            if (adicionadoAoGrupo) {
                console.log('🔄 Removendo de outros grupos...');
                const removeStartTime = Date.now();
                await removerDeOutrosGrupos(numeroFormatado, config.grupo);
                const removeEndTime = Date.now();
                console.log(`🔄 Remoção de outros grupos finalizada (${removeEndTime - removeStartTime}ms)`);
            }

            const nomeEtiqueta = `${config.sigla} - Pagamento Aprovado`;
            await adicionarEtiqueta(numeroFormatado, nomeEtiqueta);

            const totalTime = Date.now() - startTime;
            console.log(`🎉 PROCESSO COMPLETO! Tempo total: ${totalTime}ms`);

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
            console.log('\n❌ STATUS: PAGAMENTO RECUSADO');
            console.log('📝 Enviando mensagem de reprovação...');
            
            const config = configuracaoProdutos[Produto];
            if (!config) {
                console.log('❌ ERRO: Produto não reconhecido:', Produto);
                return res.status(400).json({ error: 'Produto não reconhecido' });
            }
            
            const mensagemReprovacao = `Boa noite ${Nome}! Tudo bem?\nMe chamo Isa, gostaria de te ajudar finalizar seu cadastro no ${Produto}.`;
            
            console.log(`📱 Enviando mensagem para: ${numeroFormatado}`);
            console.log('⏳ Aguardando envio da mensagem...');
            
            const messageStartTime = Date.now();
            await client.sendMessage(numeroFormatado, mensagemReprovacao);
            const messageEndTime = Date.now();
            
            console.log(`✅ Mensagem enviada com sucesso! (${messageEndTime - messageStartTime}ms)`);
            
            const nomeEtiqueta = `${config.sigla} - Pagamento Recusado`;
            await adicionarEtiqueta(numeroFormatado, nomeEtiqueta);
            
            const totalTime = Date.now() - startTime;
            console.log(`🎉 PROCESSO COMPLETO! Tempo total: ${totalTime}ms`);
            
            res.status(200).json({ 
                success: true,
                message: 'Mensagem de reprovação enviada com sucesso',
                status: 'Pagamento Recusado',
                numeroFormatado,
                produto: Produto
            });

        } else {
            console.log('❓ ERRO: Status desconhecido:', Status);
            return res.status(400).json({ error: 'Status não reconhecido' });
        }
        
    } catch (err) {
        const totalTime = Date.now() - startTime;
        console.error('\n' + '💥'.repeat(30));
        console.error('💥 ERRO CRÍTICO AO PROCESSAR REQUISIÇÃO');
        console.error(`⏰ Tempo até erro: ${totalTime}ms`);
        console.error(`❌ Mensagem: ${err.message}`);
        console.error(`❌ Stack: ${err.stack}`);
        console.error('💥'.repeat(30) + '\n');
        
        res.status(500).json({ 
            error: 'Erro ao processar solicitação',
            details: err.message 
        });
    }
    
    console.log('📨'.repeat(30));
    console.log('📨 FIM DO PROCESSAMENTO /SEND');
    console.log('📨'.repeat(30) + '\n');
});

app.get('/grupos', async (req, res) => {
    console.log('👥 Endpoint /grupos chamado');
    
    if (!whatsappReady) {
        return res.status(503).json({ error: 'WhatsApp não está pronto ainda' });
    }
    
    try {
        const chats = await client.getChats();
        const grupos = chats.filter(chat => chat.isGroup).map(grupo => ({
            id: grupo.id._serialized,
            nome: grupo.name,
            participantes: grupo.participants?.length || 0
        }));
        
        res.json({ grupos, total: grupos.length });
        
    } catch (error) {
        console.error('❌ Erro ao listar grupos:', error);
        res.status(500).json({ error: 'Erro ao listar grupos', details: error.message });
    }
});

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

app.post('/validar-numero', async (req, res) => {
    console.log('\n🔍 Endpoint /validar-numero chamado');
    
    if (!whatsappReady) {
        return res.status(503).json({ error: 'WhatsApp não está pronto ainda' });
    }
    
    const { numero } = req.body;
    
    if (!numero) {
        return res.status(400).json({ error: 'Campo "numero" é obrigatório' });
    }
    
    try {
        console.log(`🔍 Testando número: ${numero}`);
        const numeroFormatado = await formatarNumero(numero);
        
        res.json({
            success: true,
            numeroOriginal: numero,
            numeroValidado: numeroFormatado,
            message: 'Número encontrado no WhatsApp!'
        });
        
    } catch (error) {
        console.error(`❌ Erro ao validar número:`, error);
        res.status(404).json({
            success: false,
            numeroOriginal: numero,
            error: error.message
        });
    }
});


app.get('/debug-labels', async (req, res) => {
    if (!whatsappReady) {
        return res.status(503).json({ error: 'WhatsApp não pronto' });
    }
    
    try {
        // Testar labels
        const labels = await client.getLabels();
        
        // Testar um chat qualquer
        const chats = await client.getChats();
        const primeiroChat = chats.find(c => !c.isGroup);
        
        const info = {
            labelsDisponiveis: labels.map(l => ({ id: l.id, nome: l.name })),
            totalLabels: labels.length,
            chatTeste: primeiroChat ? {
                id: primeiroChat.id._serialized,
                temAddLabel: typeof primeiroChat.addLabel === 'function',
                metodosDisponiveis: Object.keys(primeiroChat).filter(k => typeof primeiroChat[k] === 'function')
            } : null
        };
        
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

console.log('🚀 Inicializando WhatsApp...');
client.initialize();

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

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
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});


