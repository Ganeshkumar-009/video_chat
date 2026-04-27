import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // 1. Setup Premium Notification Channel
  const AndroidNotificationChannel channel = AndroidNotificationChannel(
    'high_importance_channel', // id
    'High Importance Notifications', // title
    description: 'This channel is used for important chat notifications.', // description
    importance: Importance.max,
    enableVibration: true,
    playSound: true,
    showBadge: true,
  );

  const AndroidInitializationSettings initializationSettingsAndroid = AndroidInitializationSettings('@mipmap/ic_launcher');
  const InitializationSettings initializationSettings = InitializationSettings(android: initializationSettingsAndroid);
  
  await flutterLocalNotificationsPlugin.initialize(initializationSettings);

  // 2. Register the channel with Android
  await flutterLocalNotificationsPlugin
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(channel);

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Video Chat App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primarySwatch: Colors.purple,
        useMaterial3: true,
      ),
      home: const WebviewScreen(),
    );
  }
}

class WebviewScreen extends StatefulWidget {
  const WebviewScreen({super.key});

  @override
  State<WebviewScreen> createState() => _WebviewScreenState();
}

class _WebviewScreenState extends State<WebviewScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _initApp();
  }

  Future<void> _initApp() async {
    // Request permissions quietly
    await [
      Permission.camera,
      Permission.microphone,
      Permission.notification,
      Permission.photos,
      Permission.videos,
      Permission.audio,
    ].request();
    
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            setState(() => _isLoading = true);
          },
          onPageFinished: (String url) {
            setState(() => _isLoading = false);
          },
        ),
      )
      ..addJavaScriptChannel(
        'NotificationChannel',
        onMessageReceived: (JavaScriptMessage message) {
          _showNotification(message.message);
        },
      )
      ..loadRequest(Uri.parse('https://video-chat-1-t2xb.onrender.com/'));
  }

  Future<void> _showNotification(String text) async {
    const AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
            'high_importance_channel', 
            'High Importance Notifications',
            channelDescription: 'Chat Messages',
            importance: Importance.max,
            priority: Priority.high,
            ticker: 'ticker',
            color: Color(0xFF9C27B0), // Premium Purple Color
            ledColor: Color(0xFF9C27B0),
            ledOnMs: 1000,
            ledOffMs: 500,
            enableLights: true,
            enableVibration: true,
            styleInformation: BigTextStyleInformation(''), // Allows long messages
        );
    const NotificationDetails platformChannelSpecifics = NotificationDetails(android: androidPlatformChannelSpecifics);
    
    await flutterLocalNotificationsPlugin.show(
        0, 'New Message', text, platformChannelSpecifics);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0B),
      body: SafeArea(
        child: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_isLoading)
              const Center(
                child: CircularProgressIndicator(color: Colors.purple),
              ),
          ],
        ),
      ),
    );
  }
}
