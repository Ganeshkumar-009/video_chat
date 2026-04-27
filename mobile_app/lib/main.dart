import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  
  const AndroidNotificationChannel channel = AndroidNotificationChannel(
    'high_importance_channel',
    'High Importance Notifications',
    importance: Importance.max,
    enableVibration: true,
    playSound: true,
    showBadge: true,
  );

  const AndroidInitializationSettings initializationSettingsAndroid = AndroidInitializationSettings('@mipmap/ic_launcher');
  const InitializationSettings initializationSettings = InitializationSettings(android: initializationSettingsAndroid);
  
  await flutterLocalNotificationsPlugin.initialize(initializationSettings);
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
      title: 'WeChat',
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
    await [
      Permission.camera,
      Permission.microphone,
      Permission.notification,
      Permission.photos,
      Permission.videos,
      Permission.audio,
    ].request();
    
    final WebViewController controller = WebViewController();

    controller
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) => setState(() => _isLoading = true),
          onPageFinished: (String url) async {
            setState(() => _isLoading = false);
            final token = await FirebaseMessaging.instance.getToken();
            if (token != null) {
              controller.runJavaScript("if (window.setFCMToken) { window.setFCMToken('$token'); }");
            }
          },
        ),
      )
      ..addJavaScriptChannel(
        'NotificationChannel',
        onMessageReceived: (JavaScriptMessage message) => _showNotification(message.message),
      )
      ..loadRequest(Uri.parse('https://video-chat-1-t2xb.onrender.com/'));

    if (controller.platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(true);
      (controller.platform as AndroidWebViewController).setMediaPlaybackRequiresUserGesture(false);
          
      // THE NATIVE BRIDGE FOR CAMERA, GALLERY, AND FILES
      (controller.platform as AndroidWebViewController).setOnShowFileSelector(
        (FileSelectorParams params) async {
          final ImagePicker picker = ImagePicker();
          
          // 1. Handle CAMERA
          if (params.acceptTypes.contains("image/*") && params.isCaptureEnabled) {
            final XFile? photo = await picker.pickImage(source: ImageSource.camera);
            return photo != null ? [Uri.file(photo.path).toString()] : [];
          }
          
          // 2. Handle GALLERY (Images/Videos)
          if (params.acceptTypes.any((type) => type.contains('image') || type.contains('video'))) {
            final XFile? media = await picker.pickMedia();
            return media != null ? [Uri.file(media.path).toString()] : [];
          }
          
          // 3. Handle DOCUMENTS
          FilePickerResult? result = await FilePicker.platform.pickFiles();
          if (result != null && result.files.single.path != null) {
            return [Uri.file(result.files.single.path!).toString()];
          }
          
          return [];
        },
      );
    }

    _controller = controller;
  }

  Future<void> _showNotification(String text) async {
    const AndroidNotificationDetails androidPlatformChannelSpecifics = AndroidNotificationDetails(
      'high_importance_channel', 
      'High Importance Notifications',
      importance: Importance.max,
      priority: Priority.high,
      color: Color(0xFF9C27B0),
      visibility: NotificationVisibility.public,
      fullScreenIntent: true,
      styleInformation: BigTextStyleInformation(''),
    );
    await flutterLocalNotificationsPlugin.show(0, 'WeChat', text, const NotificationDetails(android: androidPlatformChannelSpecifics));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0B),
      body: SafeArea(
        child: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_isLoading) const Center(child: CircularProgressIndicator(color: Colors.purple)),
          ],
        ),
      ),
    );
  }
}
