<?php
/**
 * Auth Unit Test
 */

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;
use App\Models\User;

class AuthTest extends TestCase
{
    public function testFindUserByUserId(): void
    {
        $user = User::findByUserId('petugas_01');
        $this->assertNotNull($user);
        $this->assertEquals('petugas_01', $user['user_id']);
        $this->assertEquals('operator', $user['role']);
    }

    public function testInvalidUserReturnsNull(): void
    {
        $user = User::findByUserId('non_existent_user');
        $this->assertNull($user);
    }
}
