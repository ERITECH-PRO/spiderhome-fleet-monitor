<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\PasswordResetOtp;
use App\Services\BrevoService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;
use Mockery;

class PasswordResetTest extends TestCase
{
    use DatabaseMigrations;



    public function test_forgot_password_fails_if_email_does_not_exist()
    {
        $response = $this->postJson('/api/forgot-password', [
            'email' => 'nonexistent@spiderhome.com'
        ]);

        $response->assertStatus(404)
            ->assertJson([
                'ok' => false,
            ]);
    }

    public function test_forgot_password_generates_otp_and_sends_email()
    {
        // Mock BrevoService so we test the flow reliably without depending on external network in tests
        $brevoMock = Mockery::mock(BrevoService::class);
        $brevoMock->shouldReceive('sendPasswordResetOtp')
            ->once()
            ->andReturn(true);
        $this->app->instance(BrevoService::class, $brevoMock);

        $user = User::firstOrCreate(
            ['email' => 'admin@spiderhome.com'],
            ['name' => 'Admin Test', 'password' => Hash::make('password123'), 'role' => 'admin']
        );

        $response = $this->postJson('/api/forgot-password', [
            'email' => 'admin@spiderhome.com'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'ok' => true,
                'expires_in_minutes' => 15,
            ]);

        $this->assertDatabaseHas('password_reset_otps', [
            'email' => 'admin@spiderhome.com',
            'used_at' => null,
        ]);
    }

    public function test_forgot_password_returns_error_when_brevo_fails()
    {
        $brevoMock = Mockery::mock(BrevoService::class);
        $brevoMock->shouldReceive('sendPasswordResetOtp')
            ->once()
            ->andReturn(false);
        $brevoMock->shouldReceive('getLastError')
            ->andReturn('Brevo error description');
        $this->app->instance(BrevoService::class, $brevoMock);

        User::firstOrCreate(
            ['email' => 'admin@spiderhome.com'],
            ['name' => 'Admin Test', 'password' => Hash::make('password123'), 'role' => 'admin']
        );

        $response = $this->postJson('/api/forgot-password', [
            'email' => 'admin@spiderhome.com'
        ]);

        $response->assertStatus(500)
            ->assertJson([
                'ok' => false,
                'message' => 'Brevo error description',
            ]);
    }

    public function test_verify_otp_rejects_wrong_code_and_increments_attempts()
    {
        $user = User::firstOrCreate(
            ['email' => 'admin@spiderhome.com'],
            ['name' => 'Admin Test', 'password' => Hash::make('password123'), 'role' => 'admin']
        );

        $otp = '123456';
        $otpRecord = PasswordResetOtp::create([
            'email' => 'admin@spiderhome.com',
            'otp_hash' => Hash::make($otp),
            'expires_at' => Carbon::now()->addMinutes(15),
            'attempts' => 0,
        ]);

        // Submit wrong OTP
        $response = $this->postJson('/api/verify-otp', [
            'email' => 'admin@spiderhome.com',
            'otp' => '999999',
        ]);

        $response->assertStatus(400)
            ->assertJson([
                'ok' => false,
            ]);

        $this->assertEquals(1, $otpRecord->fresh()->attempts);
    }

    public function test_verify_otp_succeeds_with_correct_code_and_returns_reset_token()
    {
        $user = User::firstOrCreate(
            ['email' => 'admin@spiderhome.com'],
            ['name' => 'Admin Test', 'password' => Hash::make('password123'), 'role' => 'admin']
        );

        $otp = '654321';
        $otpRecord = PasswordResetOtp::create([
            'email' => 'admin@spiderhome.com',
            'otp_hash' => Hash::make($otp),
            'expires_at' => Carbon::now()->addMinutes(15),
            'attempts' => 0,
        ]);

        $response = $this->postJson('/api/verify-otp', [
            'email' => 'admin@spiderhome.com',
            'otp' => '654321',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'ok',
                'message',
                'reset_token',
            ]);

        $this->assertNotNull($otpRecord->fresh()->reset_token);
    }

    public function test_reset_password_updates_user_password_and_invalidates_otp()
    {
        $user = User::firstOrCreate(
            ['email' => 'admin@spiderhome.com'],
            ['name' => 'Admin Test', 'password' => Hash::make('oldpassword'), 'role' => 'admin']
        );

        $otp = '789123';
        $resetToken = 'sample_secure_reset_token_1234567890';
        $otpRecord = PasswordResetOtp::create([
            'email' => 'admin@spiderhome.com',
            'otp_hash' => Hash::make($otp),
            'reset_token' => $resetToken,
            'expires_at' => Carbon::now()->addMinutes(15),
            'attempts' => 0,
        ]);

        $response = $this->postJson('/api/reset-password', [
            'email' => 'admin@spiderhome.com',
            'reset_token' => $resetToken,
            'password' => 'NewSecurePassword2026!',
            'password_confirmation' => 'NewSecurePassword2026!',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'ok' => true,
            ]);

        $this->assertTrue(Hash::check('NewSecurePassword2026!', $user->fresh()->password));
        $this->assertNotNull($otpRecord->fresh()->used_at);

        // Reset back to 'admin' / default for subsequent tests
        $user->update(['password' => Hash::make('admin')]);
    }

    public function test_expired_otp_is_rejected()
    {
        $user = User::firstOrCreate(
            ['email' => 'admin@spiderhome.com'],
            ['name' => 'Admin Test', 'password' => Hash::make('password123'), 'role' => 'admin']
        );

        $otp = '123123';
        PasswordResetOtp::create([
            'email' => 'admin@spiderhome.com',
            'otp_hash' => Hash::make($otp),
            'expires_at' => Carbon::now()->subMinutes(1), // already expired
            'attempts' => 0,
        ]);

        $response = $this->postJson('/api/verify-otp', [
            'email' => 'admin@spiderhome.com',
            'otp' => '123123',
        ]);

        $response->assertStatus(400)
            ->assertJson([
                'ok' => false,
            ]);
    }

    public function test_max_attempts_exceeded_locks_otp()
    {
        $user = User::firstOrCreate(
            ['email' => 'admin@spiderhome.com'],
            ['name' => 'Admin Test', 'password' => Hash::make('password123'), 'role' => 'admin']
        );

        $otp = '555555';
        $otpRecord = PasswordResetOtp::create([
            'email' => 'admin@spiderhome.com',
            'otp_hash' => Hash::make($otp),
            'expires_at' => Carbon::now()->addMinutes(15),
            'attempts' => 5, // already reached limit
        ]);

        $response = $this->postJson('/api/verify-otp', [
            'email' => 'admin@spiderhome.com',
            'otp' => '555555',
        ]);

        $response->assertStatus(429)
            ->assertJson([
                'ok' => false,
            ]);

        $this->assertNotNull($otpRecord->fresh()->used_at);
    }

    public function test_otp_cannot_be_reused_after_password_reset()
    {
        $user = User::firstOrCreate(
            ['email' => 'admin@spiderhome.com'],
            ['name' => 'Admin Test', 'password' => Hash::make('password123'), 'role' => 'admin']
        );

        $otp = '444444';
        $resetToken = 'single_use_token_123';
        $otpRecord = PasswordResetOtp::create([
            'email' => 'admin@spiderhome.com',
            'otp_hash' => Hash::make($otp),
            'reset_token' => $resetToken,
            'expires_at' => Carbon::now()->addMinutes(15),
            'used_at' => Carbon::now(), // already consumed
            'attempts' => 0,
        ]);

        $response = $this->postJson('/api/reset-password', [
            'email' => 'admin@spiderhome.com',
            'reset_token' => $resetToken,
            'password' => 'AnotherPassword123!',
            'password_confirmation' => 'AnotherPassword123!',
        ]);

        $response->assertStatus(400)
            ->assertJson([
                'ok' => false,
            ]);
    }
}

